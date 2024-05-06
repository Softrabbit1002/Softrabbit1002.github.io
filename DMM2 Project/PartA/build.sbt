  ThisBuild / version := "0.1.0-SNAPSHOT"

  ThisBuild / scalaVersion := "2.13.14"

  lazy val root = (project in file("."))
    .settings(
      name := "untitled",
      libraryDependencies ++= Seq(
        "com.softwaremill.sttp.client3" %% "core" % "3.9.6",
        "com.softwaremill.sttp.client3" %% "circe" % "3.9.5",
        "io.circe" %% "circe-generic" % "0.14.6",
        "com.github.tototoshi" %% "scala-csv" % "1.3.10", // 添加tototoshi CSV库
        "org.knowm.xchart" % "xchart" % "3.8.6" // 添加XChart库，用于数据可视化
      )
    )