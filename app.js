require("dotenv").config();
const express=require("express");
const cors=require("cors");
const bodyParser = require("body-parser");
const userRouter = require('./routes/user');
const projectRouter = require("./routes/project");
const fs = require("fs");
const https = require("https");
const cookieParser = require("cookie-parser");
const userController = require("./controllers/userController");
const privateKey = fs.readFileSync("../key.pem", "utf8");
const certificate = fs.readFileSync("../cert.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };

const port = 4001;
const app=express();

app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    origin: "https://localhost:3000",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());

app.post('/', userController.getProjectList);
app.use('/user', userRouter);
app.use('/project', projectRouter);

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port, () => {
    console.log(`server listening on ${port}`);
});
module.exports = httpsServer;