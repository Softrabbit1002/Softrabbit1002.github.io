from xmlrpc.server import SimpleXMLRPCServer

# 定义计算函数
def add(x, y):
    return x + y

def subtract(x, y):
    return x - y

def multiply(x, y):
    return x * y

def divide(x, y):
    if y == 0:
        return "Error: Division by zero"
    return x / y

# 创建RPC服务器
server = SimpleXMLRPCServer(("localhost", 8000))
print("RPC Server is running on port 8000...")

# 注册函数，使其可以被远程调用
server.register_function(add, "add")
server.register_function(subtract, "subtract")
server.register_function(multiply, "multiply")
server.register_function(divide, "divide")

# 运行服务器
server.serve_forever()
