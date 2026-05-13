import { query } from '../db.js';

export const uploadDocumentMetadata = async (req, res) => {
  try {
    const { cliente_id, tipo_documento, nombre_archivo, mimetype, size_bytes, storage_path, metadata } = req.body;
    const cod_empresa = req.cod_empresa;

    if (!cliente_id || !tipo_documento || !storage_path) {
      return res.status(400).json({ success: false, message: 'cliente_id, tipo_documento y storage_path son requeridos' });
    }

    const result = await query(
      `INSERT INTO cl.documentos (cliente_id, cod_empresa, tipo_documento, nombre_archivo, mimetype, size_bytes, storage_path, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [cliente_id, cod_empresa, tipo_documento, nombre_archivo, mimetype, size_bytes, storage_path, metadata ? JSON.stringify(metadata) : null]
    );

    res.status(201).json({ success: true, document: result.rows[0] });
  } catch (error) {
    console.error('Error subiendo metadatos de documento:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

export const getClientDocuments = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const cod_empresa = req.cod_empresa;

    const result = await query(
      `SELECT * FROM cl.documentos WHERE cliente_id = $1 AND cod_empresa = $2 ORDER BY created_at DESC`,
      [cliente_id, cod_empresa]
    );

    res.json({ success: true, documents: result.rows });
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const cod_empresa = req.cod_empresa;

    const result = await query(
      `DELETE FROM cl.documentos WHERE id = $1 AND cod_empresa = $2 RETURNING id`,
      [id, cod_empresa]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    res.json({ success: true, message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando documento:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};
