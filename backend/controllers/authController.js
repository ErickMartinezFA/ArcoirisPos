const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
const logActivity = require('../utils/logActivity');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM usuario WHERE usuario = ?", [username]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ error: "El operador no existe" });
        }

        const passwordCorrecto = await bcrypt.compare(password, user.contrasena);
        if (!passwordCorrecto) {
            return res.status(401).json({ error: "Clave de acceso incorrecta" });
        }

        const token = jwt.sign(
            { usuario_id: user.id, sucursal_id: user.sucursal_id, rol: user.rol, username: user.usuario },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Log de acceso
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || null;
        await db.query(
            "INSERT INTO actividad_usuario (usuario_id, username, accion, modulo) VALUES (?, ?, 'LOGIN', 'autenticacion')",
            [user.id, user.usuario]
        );

        res.json({
            usuario_id: user.id,
            sucursal_id: user.sucursal_id,
            nombre: user.usuario,
            rol: user.rol,
            token,
        });
    } catch (error) {
        console.error("Error en login:", error.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

exports.logout = async (req, res) => {
    await logActivity(req, 'LOGOUT', 'Cierre de sesión');
    res.json({ message: 'ok' });
};

exports.barcodeSearch = async (req, res) => {
    const { code } = req.params;
    if (!/^\d{6,14}$/.test(code)) return res.json({ found: false });

    // 1) UPCitemdb — trial (sin key) funciona sólo fuera de datacenter;
    //    con UPCITEMDB_KEY registrado funciona desde Render también.
    try {
        const upcKey = process.env.UPCITEMDB_KEY;
        const upcUrl = upcKey
            ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(code)}`
            : `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;
        const headers = { 'Accept': 'application/json', 'User-Agent': 'ArcoirisPos/1.0' };
        if (upcKey) headers['user_key'] = upcKey;

        const r = await fetch(upcUrl, { headers });
        if (r.ok) {
            const data = await r.json();
            const item = data.items?.[0];
            if (data.code === 'OK' && item?.title) {
                return res.json({
                    found: true,
                    nombre: item.title,
                    descripcion: [item.brand, item.category?.split(' > ').pop()].filter(Boolean).join(' — '),
                });
            }
        }
    } catch { /* continúa al siguiente */ }

    // 2) Open Food Facts (productos de consumo/alimentos)
    try {
        const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, {
            headers: { 'User-Agent': 'ArcoirisPos/1.0' }
        });
        if (r.ok) {
            const data = await r.json();
            if (data.status === 1 && data.product?.product_name) {
                const p = data.product;
                return res.json({
                    found: true,
                    nombre: p.product_name,
                    descripcion: [p.brands, p.categories?.split(',')[0]?.trim()].filter(Boolean).join(' — '),
                });
            }
        }
    } catch { /* continúa */ }

    res.json({ found: false });
};

// Usada en el login para poblar el selector de sucursales antes de autenticarse
exports.getSucursales = async (req, res) => {
    try {
        const [sucursales] = await db.query('SELECT id AS sucursal_id, nombre FROM sucursal WHERE activo = 1');
        res.json(sucursales);
    } catch (error) {
        console.error("Error en getSucursales:", error.message);
        res.status(500).json({ error: "Error al cargar sucursales" });
    }
};
