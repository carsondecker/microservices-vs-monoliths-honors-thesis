import express, { type Express } from "express";
import productRoutes from "./routes/productRoutes";
import orderRoutes from "./routes/orderRoutes";

const app: Express = express();
const port = 3000;

app.use(express.json());

app.use("/api", productRoutes);
app.use("/api", orderRoutes);

app.listen(port, () => {
  console.log(`Monolith listening on port ${port}`);
});
