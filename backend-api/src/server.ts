import express from "express";
import usersRoutes from "./routes/users.routes";

const app = express();

app.use(express.json());

// User CRUD APIs
app.use("/api/users", usersRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});