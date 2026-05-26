const express = require("express");
const axios = require("axios");
const {Pool} = require("pg");
const cors = require("cors"); // Vital para conectar con el frontend

const app = express();
app.use(express.json());
app.use(cors());

// Conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Intentar conectar a la BD con reintentos antes de iniciar el servidor
async function ensureDatabaseReady() {
  const maxRetries = 10;
  let attempt = 0;

  while (true) {
    try {
      await pool.query("SELECT 1");
      console.log("✅ Conectado a PostgreSQL exitosamente");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pokemon (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          type VARCHAR(50)
        )
      `);
      console.log("✅ Tabla 'pokemon' lista para usarse");
      break;
    } catch (err) {
      attempt++;
      console.error(
        `❌ Intento ${attempt} - Error conectando a BD: ${err.message}`,
      );
      if (attempt >= maxRetries) {
        console.error(
          "❌ No se pudo conectar a la BD tras varios intentos. Saliendo.",
        );
        process.exit(1);
      }
      // Esperar 2s antes de reintentar
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

app.get("/api/catch/:name", async (req, res) => {
  try {
    const pokeName = req.params.name.toLowerCase();
    const {data} = await axios.get(
      `https://pokeapi.co/api/v2/pokemon/${pokeName}`,
    );
    const name = data.name;
    const type = data.types[0].type.name;

    await pool.query("INSERT INTO pokemon (name, type) VALUES ($1, $2)", [
      name,
      type,
    ]);
    res.json({
      message: "Pokémon atrapado y guardado en PostgreSQL",
      pokemon: {name, type},
    });
  } catch (error) {
    console.error("❌ Error atrapando:", error.message);
    res
      .status(500)
      .json({error: "Error atrapando al Pokémon o guardando en BD"});
  }
});

app.get("/api/list", async (req, res) => {
  try {
    const {rows} = await pool.query("SELECT * FROM pokemon");
    res.json(rows);
  } catch (error) {
    console.error("❌ Error listando:", error.message);
    res.status(500).json({error: "Error consultando la BD"});
  }
});

const PORT = 5000;

ensureDatabaseReady().then(() => {
  app.listen(PORT, () => console.log(`✅ Backend corriendo en puerto ${PORT}`));
});
