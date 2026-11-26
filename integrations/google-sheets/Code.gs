/**
 * CRM Comercial Empresarial - Conector de Ingesta desde Google Sheets (Code.gs)
 *
 * Regla de negocio rectora (ADR-002):
 * Google Sheets opera exclusivamente como canal de captura hacia el CRM.
 * El CRM Backend es la unica Fuente de Verdad: normaliza telefonos (+502),
 * deduplica prospectos y protege etapas comerciales avanzadas contra sobrescrituras.
 *
 * Configuracion requerida en Google Apps Script:
 * Ir a "Configuracion del proyecto" -> "Propiedades de secuencia de comandos" y definir:
 *   1. CRM_API_BASE_URL       = https://api.su-dominio-crm.com (o tunel seguro en pruebas)
 *   2. CRM_INTEGRATION_KEY    = <valor exacto de INTEGRATION_API_KEY en el servidor>
 *   3. CRM_TARGET_SHEET_NAME  = CapturaLeads
 *
 * Seguridad:
 * NUNCA escriba claves ni tokens directamente en este codigo fuente.
 */

var SYNC_ENDPOINT_PATH = '/api/v1/integrations/sheets/sync';
var HEADER_ROW_INDEX = 1;
var STATUS_COLUMN_INDEX = 10; // Columna J: Estado de sincronizacion con CRM

/**
 * Trigger instalable recomendado (onEdit instalable con permisos de UrlFetchApp).
 * Sincroniza la fila editada cuando contiene al menos nombre y telefono.
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e Evento de edicion de hoja.
 */
function onSheetRowEdit(e) {
  if (!e || !e.range) {
    return;
  }

  var config = getConnectorConfig_();
  var sheet = e.range.getSheet();

  if (sheet.getName() !== config.targetSheetName) {
    return;
  }

  var editedRow = e.range.getRow();
  if (editedRow <= HEADER_ROW_INDEX) {
    return;
  }

  // Evita bucle infinito cuando el propio script actualiza la columna de estado
  if (e.range.getColumn() === STATUS_COLUMN_INDEX) {
    return;
  }

  syncSingleRow_(sheet, editedRow, config);
}

/**
 * Funcion manual o programada por tiempo para enviar todas las filas pendientes.
 */
function syncPendingRowsBatch() {
  var config = getConnectorConfig_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(config.targetSheetName);

  if (!sheet) {
    throw new Error('No existe la pestana configurada: ' + config.targetSheetName);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW_INDEX) {
    return;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, STATUS_COLUMN_INDEX).getValues();
  var batchItems = [];
  var rowNumbers = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var currentStatus = String(row[STATUS_COLUMN_INDEX - 1] || '').trim();
    var fullName = String(row[0] || '').trim();
    var rawPhone = String(row[1] || '').trim();

    if (currentStatus.indexOf('SYNC_OK') === 0) {
      continue;
    }

    if (!fullName || !rawPhone) {
      continue;
    }

    var sheetRowNumber = i + 2;
    batchItems.push(mapRowToLeadPayload_(row, spreadsheet.getId(), sheet.getName(), sheetRowNumber));
    rowNumbers.push(sheetRowNumber);
  }

  if (batchItems.length === 0) {
    return;
  }

  sendPayloadToCrm_(sheet, rowNumbers, batchItems, config);
}

/**
 * Sincroniza una unica fila hacia el endpoint del CRM.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Hoja activa.
 * @param {number} rowNumber Numero de fila (base 1).
 * @param {{apiBaseUrl: string, integrationKey: string, targetSheetName: string}} config Configuracion.
 */
function syncSingleRow_(sheet, rowNumber, config) {
  var row = sheet.getRange(rowNumber, 1, 1, STATUS_COLUMN_INDEX).getValues()[0];
  var fullName = String(row[0] || '').trim();
  var rawPhone = String(row[1] || '').trim();

  if (!fullName || !rawPhone) {
    return;
  }

  var spreadsheetId = sheet.getParent().getId();
  var item = mapRowToLeadPayload_(row, spreadsheetId, sheet.getName(), rowNumber);
  sendPayloadToCrm_(sheet, [rowNumber], [item], config);
}

/**
 * Transforma una fila de Google Sheets al contrato JSON esperado por el CRM.
 */
function mapRowToLeadPayload_(row, spreadsheetId, sheetName, rowNumber) {
  return {
    externalRowId: spreadsheetId + ':' + sheetName + ':' + String(rowNumber),
    nombreCompleto: String(row[0] || '').trim(),
    telefono: String(row[1] || '').trim(),
    correo: String(row[2] || '').trim() || null,
    empresa: String(row[3] || '').trim() || null,
    canalOrigen: String(row[4] || 'GOOGLE_SHEETS').trim(),
    interesComercial: String(row[5] || '').trim() || null,
    municipio: String(row[6] || '').trim() || null,
    departamento: String(row[7] || '').trim() || null,
    notasIniciales: String(row[8] || '').trim() || null
  };
}

/**
 * Envia el lote al backend del CRM autenticando con cabecera X-Integration-Key.
 */
function sendPayloadToCrm_(sheet, rowNumbers, items, config) {
  var idempotencyKey = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(items)
  ).map(function (byte) {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');

  var requestOptions = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'X-Integration-Key': config.integrationKey,
      'X-Idempotency-Key': idempotencyKey
    },
    payload: JSON.stringify({
      source: 'GOOGLE_SHEETS',
      sentAt: new Date().toISOString(),
      leads: items
    })
  };

  var endpointUrl = config.apiBaseUrl.replace(/\/+$/, '') + SYNC_ENDPOINT_PATH;
  var response = UrlFetchApp.fetch(endpointUrl, requestOptions);
  var statusCode = response.getResponseCode();
  var timestamp = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd HH:mm:ss');

  var statusLabel = (statusCode >= 200 && statusCode < 300)
    ? 'SYNC_OK ' + timestamp
    : 'SYNC_ERROR_HTTP_' + String(statusCode) + ' ' + timestamp;

  for (var i = 0; i < rowNumbers.length; i++) {
    sheet.getRange(rowNumbers[i], STATUS_COLUMN_INDEX).setValue(statusLabel);
  }
}

/**
 * Obtiene y valida las propiedades seguras del proyecto Apps Script.
 */
function getConnectorConfig_() {
  var props = PropertiesService.getScriptProperties();
  var apiBaseUrl = props.getProperty('CRM_API_BASE_URL');
  var integrationKey = props.getProperty('CRM_INTEGRATION_KEY');
  var targetSheetName = props.getProperty('CRM_TARGET_SHEET_NAME') || 'CapturaLeads';

  if (!apiBaseUrl || !integrationKey) {
    throw new Error(
      'Faltan propiedades obligatorias CRM_API_BASE_URL o CRM_INTEGRATION_KEY en ScriptProperties.'
    );
  }

  return {
    apiBaseUrl: apiBaseUrl,
    integrationKey: integrationKey,
    targetSheetName: targetSheetName
  };
}
