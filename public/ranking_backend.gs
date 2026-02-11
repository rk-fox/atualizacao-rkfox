
// ==========================================
// CONFIGURAÇÃO
// ==========================================
const SCRIPT_VERSION = "1.0";
const SHEET_RANKING = "Ranking";
const SHEET_HISTORY = "Historico";
// Proxy para contornar bloqueios de CORS/IP do Rollercoin se necessário, 
// mas o Google Script geralmente roda server-side ok. 
// O usuário forneceu este endpoint:
const PROXY_URL = "https://summer-night-03c0.rk-foxx-159.workers.dev/?https://rollercoin.com/api/profile/user-power-data/";

// ==========================================
// API HANDLERS
// ==========================================

// GET: Retorna os dados do Ranking e Histórico
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rankingSheet = ss.getSheetByName(SHEET_RANKING);
  const historySheet = ss.getSheetByName(SHEET_HISTORY);
  
  if (!rankingSheet || !historySheet) {
    return ContentService.createTextOutput(JSON.stringify({error: "Abas 'Ranking' ou 'Historico' não encontradas."}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const rankingData = rankingSheet.getDataRange().getValues();
  const historyData = historySheet.getDataRange().getValues();
  
  // Remove headers
  const rankingHeaders = rankingData.shift();
  // Headers esperados: ID, Name, Avatar, Miners, BonusPct, Racks, TotalPower, PreviousRank, LastUpdate
  
  const historyHeaders = historyData.shift();
  
  const users = rankingData.map(row => ({
    id: row[0],
    name: row[1],
    avatar: row[2],
    stats: {
      miners: Number(row[3]),
      bonus_percent: Number(row[4]),
      racks: Number(row[5]),
      total: Number(row[6])
    },
    previous_rank: Number(row[7]),
    last_update: row[8]
  })).filter(u => u.stats.total > 0); // Filtra usuários sem poder (novos/pendentes)
  
  // Otimizar histórico: Agrupar por usuário
  const history = {};
  historyData.forEach(row => {
    const userId = row[1]; // Supondo col B = ID
    if (!history[userId]) history[userId] = [];
    history[userId].push({
      date: row[0],
      miners: Number(row[2]),
      bonus: Number(row[3]),
      total: Number(row[4])
    });
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    ranking: users,
    history: history,
    ref_date: new Date() // Data da requisição
  })).setMimeType(ContentService.MimeType.JSON);
}

// POST: Recebe solicitações de inclusão
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const name = params.name;
    const avatarUrl = params.avatarUrl;
    
    if (!name || !avatarUrl) {
      throw new Error("Nome e Link do Avatar são obrigatórios.");
    }
    
    // Extrair ID do link do avatar
    const idMatch = avatarUrl.match(/\/([a-z0-9]{24})\.png/);
    if (!idMatch) {
      throw new Error("Não foi possível extrair o ID do link do avatar.");
    }
    const userId = idMatch[1];
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_RANKING);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_RANKING);
      sheet.appendRow(["ID", "Name", "Avatar", "Miners", "BonusPct", "Racks", "TotalPower", "PreviousRank", "LastUpdate"]);
    }
    
    // Verificar se já existe
    const data = sheet.getDataRange().getValues();
    const exists = data.some(r => r[0] === userId);
    
    if (exists) {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: "Usuário já está no ranking."}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // NÃO buscar dados iniciais. Registrar zerado.
    // Só vai pegar dados quando rodar o updateAllUsers (Mensal)
    
    sheet.appendRow([
      userId, 
      name, 
      avatarUrl, 
      0, // Miners
      0, // BonusPct
      0, // Racks
      0, // TotalPower
      9999, // Rank anterior
      "Pendente" // LastUpdate
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({success: true, message: "Solicitação enviada! Você aparecerá no ranking na próxima atualização mensal."}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

function fetchRCData(userId) {
  try {
    const url = PROXY_URL + userId;
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const json = JSON.parse(response.getContentText());
    
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (e) {
    Logger.log("Erro ao buscar RC: " + e);
    return null;
  }
}

// Função principal de atualização diária (Time-driven trigger)
function updateAllUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rankingSheet = ss.getSheetByName(SHEET_RANKING);
  const historySheet = ss.getSheetByName(SHEET_HISTORY); // Colunas: Date, ID, Miners, Bonus, Total
  
  if (!rankingSheet || !historySheet) return;
  
  const data = rankingSheet.getDataRange().getValues();
  const headers = data.shift(); // Remove header
  
  const today = new Date();
  
  // Array atualizado
  const updatedRows = [];
  
  data.forEach((row, index) => {
    const userId = row[0];
    const name = row[1];
    const avatar = row[2];
    const currentRank = index + 1; // Assumindo que a planilha ja estava ordenada antes
    
    const rcData = fetchRCData(userId);
    
    if (rcData) {
      const miners = rcData.miners;
      const bonusPct = rcData.bonus_percent;
      const racks = rcData.racks;
      // Bonus Power Real = Miners * (BonusPct / 10000) ???
      // User disse: "miners":5613187796, "bonus_percent":271542, "bonus":152421624050.1432
      // 5613187796 * (271542 / 10000 / 100) = 5613 * 0.27... nao bate.
      // 5613 GH * (2715.42%) ?
      // 5613187796 * 27.1542 = 1.524... e11. Sim, parece que bonus_percent é raw. 
      // Se bonus percent é 271542.
      // E bonus value é 152421624050.
      // 152421624050 / 5613187796 = 27.1543.
      // Entao bonus_percent 271542 deve ser dividido por 10000 para dar %. (27.1542%).
      
      const totalPower = miners + rcData.bonus + racks;
      
      // Salvar no Histórico
      historySheet.appendRow([today, userId, miners, rcData.bonus, totalPower]);
      
      // Atualizar linha
      // Mantendo ID, Name, Avatar. Atualizando Stats.
      // Previous Rank agora é o Rank que ele tinha ANTES dessa execução (currentRank)
      updatedRows.push([userId, name, avatar, miners, bonusPct, racks, totalPower, currentRank, today]);
    } else {
      // Se falhar, mantem dados antigos mas atualiza rank previo?
      // Melhor manter tudo igual
      updatedRows.push([...row]); 
      // Atualiza só previous rank? Não, se não atualizou poder, mantem.
    }
  });
  
  // Reordenar por Total Power (Desc)
  updatedRows.sort((a, b) => b[6] - a[6]);
  
  // Salvar de volta na planilha
  // Limpar dados antigos (menos header)
  if (data.length > 0) {
    rankingSheet.getRange(2, 1, rankingSheet.getLastRow() - 1, rankingSheet.getLastColumn()).clearContent();
  }
  
  // Escrever novos
  if (updatedRows.length > 0) {
    rankingSheet.getRange(2, 1, updatedRows.length, updatedRows[0].length).setValues(updatedRows);
  }
}

function updateRankingOrder() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_RANKING);
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    range.sort({column: 7, ascending: false}); // Coluna 7 = TotalPower
}


// ==========================================
// MIGRATION TOOLS (One-time use)
// ==========================================

/*
  INSTRUÇÕES DE MIGRAÇÃO:
  1. Crie uma aba chamada "Origem_Ranking" e cole os dados da PLANILHA1 (Apenas valores).
     - Coluna A: ID
     - Coluna B: Nome (Nick)
     - Coluna C: Posição (Rank Anterior)
     - Coluna D: Inicial (Poder Inicial do Mês)
  
  2. Crie uma aba chamada "Origem_Historico" e cole os dados da PLANILHA3 (Tudo).
     - Linha 1: Datas (D1, G1, J1...)
     - Coluna B: IDs dos usuários
     - Colunas de Dados: D, E, F (Miner, Bonus, Total) repetindo a cada 3 colunas.
     
  3. Execute a função "runMigration" abaixo.
*/

function runMigration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const originRanking = ss.getSheetByName("Origem_Ranking");
  const originHistory = ss.getSheetByName("Origem_Historico");
  
  const destRanking = ss.getSheetByName(SHEET_RANKING);
  const destHistory = ss.getSheetByName(SHEET_HISTORY);
  
  if (!originRanking || !originHistory || !destRanking || !destHistory) {
    Logger.log("Erro: Abas de origem ou destino não encontradas. Verifique os nomes.");
    return;
  }
  
  // 1. Migrar Ranking
  const rData = originRanking.getDataRange().getValues();
  // Assume Row 1 is Header? Or data starts A1? Let's assume A1 has data if no header, or ask user to remove header.
  // Best verify: check if A1 is "ID".
  let rStartRow = 0;
  if (String(rData[0][0]).toLowerCase() === "id") rStartRow = 1;
  
  const usersMap = {}; // ID -> Name
  const rankingRows = [];
  
  for (let i = rStartRow; i < rData.length; i++) {
    const row = rData[i];
    const id = row[0];
    const name = row[1];
    const pos = row[2]; // Previous Rank
    const initial = row[3]; // Initial Power (Not used directly in new structure, but could be history entry)
    
    if (!id) continue;
    
    usersMap[id] = name;
    
    // Generate avatar link
    // https://avatars.rollercoin.com/static/avatars/thumbnails/48/{id}.png?v=1
    const avatar = `https://avatars.rollercoin.com/static/avatars/thumbnails/48/${id}.png?v=1`;
    
    // Stats will be 0 initially, updated by updateAllUsers later
    // Or we could try to get latest from history?
    rankingRows.push([
      id, name, avatar, 0, 0, 0, 0, pos || 9999, new Date()
    ]);
  }
  
  // Clear and Write Ranking
  if (rankingRows.length > 0) {
    destRanking.getRange(2, 1, destRanking.getLastRow(), destRanking.getLastColumn()).clearContent();
    destRanking.getRange(2, 1, rankingRows.length, rankingRows[0].length).setValues(rankingRows);
  }
  
  // 2. Migrar Histórico
  const hData = originHistory.getDataRange().getValues();
  const historyRows = [];
  
  // Headers (Dates) at Row 0?
  // Check Columns D, G, J...
  // Row 0, Col 3 (D) = Date?
  // Row 0, Col 6 (G) = Date?
  
  const dateRow = hData[0]; // Row 1
  
  // Iterate users (Rows) - Start from Row 1 or 2?
  // Assume Row 1 is data if Row 0 is header
  
  for (let r = 1; r < hData.length; r++) {
    const row = hData[r];
    const id = row[1]; // Col B = ID
    
    if (!id) continue;
    
    // Iterate columns in steps of 3
    // Start Col D (Index 3)
    for (let c = 3; c < row.length - 2; c += 3) {
      const dateVal = dateRow[c]; // Header date
      const miner = row[c];
      const bonus = row[c+1];
      const total = row[c+2];
      
      // Check if valid data
      if (!dateVal && !miner && !total) break; // End of data for this row?
           
      // If header has date, use it. If not, maybe empty column?
      if (dateVal && (miner || total)) {
         let entryDate = parseBrDate(dateVal);
         
         if (entryDate) {
           historyRows.push([
             entryDate, id, Number(miner||0), Number(bonus||0), Number(total||0)
           ]);
         }
      }
    }
  }
  
  // Clear and Write History
  if (historyRows.length > 0) {
    destHistory.getRange(2, 1, destHistory.getLastRow(), destHistory.getLastColumn()).clearContent();
    
    // Write in chunks to avoid timeout
    const chunkSize = 5000;
    for (let i=0; i < historyRows.length; i += chunkSize) {
      const chunk = historyRows.slice(i, i + chunkSize);
      const range = destHistory.getRange(2 + i, 1, chunk.length, chunk[0].length);
      range.setValues(chunk);
      // Force date format dd/MM/yyyy on first column
      range.offset(0, 0, chunk.length, 1).setNumberFormat("dd/mm/yyyy");
    }
  }
  
  Logger.log(`Migração Concluída. Ranking: ${rankingRows.length} linhas. Histórico: ${historyRows.length} entradas.`);
}

function parseBrDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // Try dd/mm/yyyy
    const parts = value.split('/');
    if (parts.length === 3) {
      // Month is 0-indexed in JS Date
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    // Try yyyy-mm-dd
    const isoParts = value.split('-');
    if (isoParts.length === 3) {
      return new Date(isoParts[0], isoParts[1] - 1, isoParts[2]);
    }
  }
  return new Date(value); // Fallback
}

