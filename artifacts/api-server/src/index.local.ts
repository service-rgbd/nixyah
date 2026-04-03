process.env.PORT = "3334";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

await import("./index.js");