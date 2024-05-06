import sttp.client3._
import sttp.client3.circe._
import io.circe.generic.auto._
import scala.annotation.tailrec
import scala.io.StdIn
import scala.util.{Failure, Success, Try}
import java.io._
import com.github.tototoshi.csv.CSVReader
import org.knowm.xchart.{SwingWrapper, XYChart, XYChartBuilder, XYSeries}
import org.knowm.xchart.style.markers.SeriesMarkers
import java.time.{LocalDate, LocalDateTime}
import java.time.format.{DateTimeFormatter, DateTimeParseException}
import scala.collection.mutable

case class EnergyDataEntry(datasetId: Int, startTime: String, endTime: String, value: Double)
case class EnergyDataResponse(data: List[EnergyDataEntry], pagination: Pagination)
case class Pagination(total: Int, lastPage: Int, prevPage: Option[Int], nextPage: Option[Int], perPage: Int, currentPage: Int, from: Int, to: Int)

object FingridClient {
  val baseUrl = "https://data.fingrid.fi/api/datasets"
  val apiKey = "e04afa94a2274af3bacb4be7eb39ee6b"
  implicit val backend = HttpURLConnectionBackend()

  def fetchEnergyData(datasetId: Int, startTime: Option[String], endTime: Option[String], pageSize: Option[Int], oneRowPerTimePeriod: Option[Boolean]): Either[String, EnergyDataResponse] = {
    val uri = uri"$baseUrl/$datasetId/data?startTime=$startTime&endTime=$endTime&pageSize=$pageSize&oneRowPerTimePeriod=$oneRowPerTimePeriod"
    val request = basicRequest.get(uri).header("x-api-key", apiKey).response(asJson[EnergyDataResponse])
    Try(request.send(backend).body) match {
      case Success(Right(data)) => Right(data)
      case Success(Left(deserializationError)) => Left(deserializationError.getMessage)
      case Failure(exception) => Left(exception.getMessage)
    }
  }
}

object CsvUtil {
  def writeDataToCsv(data: List[EnergyDataEntry], filename: String, append: Boolean): Unit = {
    val file = new File(filename)
    val bw = new BufferedWriter(new FileWriter(file, append))
    try {
      if (file.length() == 0) {
        bw.write("DatasetId,StartTime,EndTime,Value\n")
      }
      data.foreach { entry =>
        bw.write(s"${entry.datasetId},${entry.startTime},${entry.endTime},${entry.value}\n")
      }
    } finally {
      bw.close()
    }
  }

  def readDataFromCsvById(filename: String, datasetId: Int): List[EnergyDataEntry] = {
    val reader = CSVReader.open(new File(filename))
    val data = reader.allWithHeaders().map { row =>
      EnergyDataEntry(
        datasetId = row("DatasetId").toInt,
        startTime = row("StartTime"),
        endTime = row("EndTime"),
        value = row("Value").toDouble
      )
    }.filter(_.datasetId == datasetId)
    reader.close()
    data
  }

  def calculateMean(data: List[Double]): Double = {
    if (data.isEmpty) 0.0 else data.sum / data.size
  }

  def calculateMedian(data: List[Double]): Double = {
    val sortedData = data.sorted
    if (sortedData.size % 2 == 1) sortedData(sortedData.size / 2)
    else (sortedData(sortedData.size / 2 - 1) + sortedData(sortedData.size / 2)) / 2.0
  }

  def calculateMode(data: List[Double]): Double = {
    val frequencyMap = mutable.Map[Double, Int]()
    data.foreach(value => frequencyMap(value) = frequencyMap.getOrElse(value, 0) + 1)
    if (frequencyMap.isEmpty) 0.0 else frequencyMap.maxBy(_._2)._1
  }

  def calculateRange(data: List[Double]): Double = {
    if (data.isEmpty) 0.0 else data.max - data.min
  }

  def calculateMidrange(data: List[Double]): Double = {
    if (data.isEmpty) 0.0 else (data.max + data.min) / 2.0
  }

  def detectLowEnergy(data: List[EnergyDataEntry], thresholdPercentage: Double = 0.7): List[EnergyDataEntry] = {
    val values = data.map(_.value)
    val meanValue = calculateMean(values)
    val threshold = meanValue * thresholdPercentage
    data.filter(_.value < threshold)
  }
}
object ChartUtil {
  def createChart(data: List[EnergyDataEntry]): XYChart = {
    val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    val xData = data.map(entry => LocalDateTime.parse(entry.startTime, formatter).toEpochSecond(java.time.ZoneOffset.UTC).toDouble)
    val yData = data.map(_.value)
    val chart = new XYChartBuilder().width(800).height(600).title("Energy Data Overview").xAxisTitle("Time").yAxisTitle("Value").build()
    val series = chart.addSeries("Energy Data", xData.toArray, yData.toArray)
    series.setMarker(SeriesMarkers.NONE)
    chart
  }

  def displayChart(chart: XYChart): Unit = {
    new SwingWrapper(chart).displayChart()
  }
}

object Main extends App {
  @tailrec
  def getValidDate(prompt: String): String = {
    println(prompt)
    val input = StdIn.readLine()
    try {
      LocalDate.parse(input, DateTimeFormatter.ofPattern("yyyy-MM-dd"))
      input
    } catch {
      case e: DateTimeParseException =>
        println("Invalid date format. Please enter the date in the format 'yyyy-MM-dd', e.g., '2022-01-01'.")
        getValidDate(prompt)
    }
  }

  @tailrec
  def mainMenu(): Unit = {
    println("Welcome to use the REPS!")
    println("Do you want to search for data, view chart, analyze data, or exit? (1 for search, 2 for view, 3 for analyze, 0 to exit):")
    val decision = StdIn.readInt()

    decision match {
      case 1 =>
        println("Enter the dataset ID:")
        val datasetId = StdIn.readInt()
        val startTime = getValidDate("Enter the start time (e.g., 2022-01-01):")
        val endTime = getValidDate("Enter the end time (e.g., 2022-01-02):")
        println("Enter the page size (number of entries per page, optional):")
        val pageSize = Try(StdIn.readInt()).toOption
        println("Should each time period have only one row? (true/false, optional):")
        val oneRowPerTimePeriod = Try(StdIn.readBoolean()).toOption
        FingridClient.fetchEnergyData(datasetId, Some(startTime), Some(endTime), pageSize, oneRowPerTimePeriod) match {
          case Right(response) =>
            println("Data fetched successfully!")
            CsvUtil.writeDataToCsv(response.data, "energy_data.csv", append = true)
            println("Data appended to 'energy_data.csv' successfully.")
          case Left(error) =>
            println(s"Error fetching data: $error")
        }
        mainMenu()
      case 2 =>
        println("Enter the dataset ID to view the chart (e.g., 191 or 247):")
        val chartId = StdIn.readInt()
        val data = CsvUtil.readDataFromCsvById("energy_data.csv", chartId)
        if (data.isEmpty) {
          println(s"No data found for dataset ID $chartId.")
        } else {
          val chart = ChartUtil.createChart(data)
          ChartUtil.displayChart(chart)
        }
        mainMenu()
      case 3 =>
        println("Enter the dataset ID to analyze (e.g., 191):")
        val analysisId = StdIn.readInt()
        val data = CsvUtil.readDataFromCsvById("energy_data.csv", analysisId)
        val values = data.map(_.value)
        if (values.isEmpty) {
          println(s"No data found for dataset ID $analysisId.")
        } else {
          println("Select the statistic to compute: 1-Mean, 2-Median, 3-Mode, 4-Range, 5-Midrange, 6-Low Energy Check")
          val choice = StdIn.readInt()

          choice match {
            case 1 => println(s"Mean: ${CsvUtil.calculateMean(values)}")
            case 2 => println(s"Median: ${CsvUtil.calculateMedian(values)}")
            case 3 => println(s"Mode: ${CsvUtil.calculateMode(values)}")
            case 4 => println(s"Range: ${CsvUtil.calculateRange(values)}")
            case 5 => println(s"Midrange: ${CsvUtil.calculateMidrange(values)}")
            case 6 =>
              val lowEnergyEntries = CsvUtil.detectLowEnergy(data)
              if (lowEnergyEntries.isEmpty) {
                println("No low energy outputs detected.")
              } else {
                println("Low energy output dates:")
                lowEnergyEntries.foreach(entry => println(s"Date: ${entry.startTime}, Value: ${entry.value}"))
              }
            case _ => println("Invalid option selected.")
          }
        }
        mainMenu()
      case 0 =>
        println("Exiting program.")
      case _ =>
        println("Invalid input, please enter 1, 2, 3, or 0.")
        mainMenu()
    }
  }

  // Start the main menu
  mainMenu()
}
