// En tu servidor (index.js o tu archivo de rutas)
app.get('/api/sucursales', async (req, res) => {
    try {
        // 1. Verificamos que la tabla se llame exactamente como en tu DB
        // Nota: En SQL los nombres de tablas suelen ser minúsculas
        const [rows] = await db.query("SELECT sucursal_id, Nombre FROM sucursal");
        console.log("✅ Sucursales encontradas:", rows);
        res.json(rows);
    } catch (error) {
        // 2. Este log nos dirá la verdad en la terminal
        console.error("❌ ERROR CRÍTICO EN /api/sucursales:");
        console.error(error.message); 
        
        res.status(500).json({ 
            error: "Error interno del servidor", 
            details: error.message 
        });
    }
});