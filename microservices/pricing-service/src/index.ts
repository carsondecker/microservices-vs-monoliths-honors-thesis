import express, { type Express } from "express";
import routes from "./routes/routes";

const app: Express = express();
const port = 3000;

app.use(express.json());

app.use("/api", routes);

app.listen(port, () => {
  console.log(`Pricing service listening on port ${port}`);
});
