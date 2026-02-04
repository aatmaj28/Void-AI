// Mock data for Void AI

export interface Stock {
  ticker: string
  company: string
  sector: string
  industry: string
  marketCap: number
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  analystCount: number
  gapScore: number
  activityScore: number
  opportunityType: "High Activity Low Coverage" | "Emerging Coverage Gap" | "Institutional Blind Spot" | "Sector Mispricing"
  pe?: number
  high52w: number
  low52w: number
  priceHistory: number[]
}

export interface Alert {
  id: string
  type: "gap_increase" | "coverage_change" | "volume_spike" | "price_movement" | "new_opportunity"
  severity: "low" | "medium" | "high"
  ticker: string
  message: string
  timestamp: Date
  read: boolean
}

export interface Watchlist {
  id: string
  name: string
  stocks: string[]
  createdAt: Date
}

const sectors = ["Technology", "Healthcare", "Finance", "Industrial", "Consumer", "Energy", "Materials", "Utilities", "Real Estate", "Communications"]
const opportunityTypes: Stock["opportunityType"][] = ["High Activity Low Coverage", "Emerging Coverage Gap", "Institutional Blind Spot", "Sector Mispricing"]

function generatePriceHistory(basePrice: number, days: number = 30): number[] {
  const history: number[] = []
  let price = basePrice * (0.85 + Math.random() * 0.3)
  for (let i = 0; i < days; i++) {
    price = price * (0.97 + Math.random() * 0.06)
    history.push(Number(price.toFixed(2)))
  }
  return history
}

export const mockStocks: Stock[] = [
  { ticker: "NVAX", company: "Novavax Inc", sector: "Healthcare", industry: "Biotechnology", marketCap: 1200000000, price: 14.52, change: 0.87, changePercent: 6.38, volume: 8500000, avgVolume: 5200000, analystCount: 3, gapScore: 92, activityScore: 88, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 28.45, low52w: 8.12, priceHistory: generatePriceHistory(14.52) },
  { ticker: "IONQ", company: "IonQ Inc", sector: "Technology", industry: "Quantum Computing", marketCap: 2800000000, price: 12.34, change: -0.45, changePercent: -3.52, volume: 12000000, avgVolume: 8000000, analystCount: 4, gapScore: 89, activityScore: 91, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 22.00, low52w: 6.45, priceHistory: generatePriceHistory(12.34) },
  { ticker: "BTDR", company: "Bitdeer Technologies", sector: "Technology", industry: "Crypto Mining", marketCap: 890000000, price: 8.76, change: 1.23, changePercent: 16.34, volume: 15000000, avgVolume: 4500000, analystCount: 2, gapScore: 95, activityScore: 94, opportunityType: "High Activity Low Coverage", pe: 45.2, high52w: 15.80, low52w: 3.20, priceHistory: generatePriceHistory(8.76) },
  { ticker: "AEHR", company: "Aehr Test Systems", sector: "Technology", industry: "Semiconductors", marketCap: 650000000, price: 21.45, change: -1.12, changePercent: -4.96, volume: 2800000, avgVolume: 1500000, analystCount: 2, gapScore: 87, activityScore: 78, opportunityType: "Institutional Blind Spot", pe: 32.1, high52w: 52.00, low52w: 14.25, priceHistory: generatePriceHistory(21.45) },
  { ticker: "GEVO", company: "Gevo Inc", sector: "Energy", industry: "Renewable Fuels", marketCap: 450000000, price: 1.87, change: 0.15, changePercent: 8.72, volume: 9200000, avgVolume: 5800000, analystCount: 3, gapScore: 84, activityScore: 82, opportunityType: "Sector Mispricing", pe: undefined, high52w: 4.50, low52w: 0.95, priceHistory: generatePriceHistory(1.87) },
  { ticker: "DMTK", company: "DermTech Inc", sector: "Healthcare", industry: "Diagnostics", marketCap: 320000000, price: 6.23, change: 0.34, changePercent: 5.77, volume: 1800000, avgVolume: 900000, analystCount: 2, gapScore: 91, activityScore: 76, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 18.50, low52w: 4.10, priceHistory: generatePriceHistory(6.23) },
  { ticker: "HIMS", company: "Hims & Hers Health", sector: "Healthcare", industry: "Telehealth", marketCap: 4200000000, price: 19.87, change: 2.15, changePercent: 12.14, volume: 18000000, avgVolume: 8500000, analystCount: 5, gapScore: 78, activityScore: 89, opportunityType: "High Activity Low Coverage", pe: 85.3, high52w: 24.00, low52w: 6.80, priceHistory: generatePriceHistory(19.87) },
  { ticker: "APLD", company: "Applied Digital", sector: "Technology", industry: "Data Centers", marketCap: 780000000, price: 5.43, change: 0.67, changePercent: 14.08, volume: 22000000, avgVolume: 9000000, analystCount: 3, gapScore: 86, activityScore: 92, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 12.50, low52w: 2.80, priceHistory: generatePriceHistory(5.43) },
  { ticker: "CIFR", company: "Cipher Mining", sector: "Technology", industry: "Crypto Mining", marketCap: 1100000000, price: 4.12, change: 0.54, changePercent: 15.08, volume: 28000000, avgVolume: 12000000, analystCount: 4, gapScore: 82, activityScore: 95, opportunityType: "High Activity Low Coverage", pe: 28.5, high52w: 8.90, low52w: 2.10, priceHistory: generatePriceHistory(4.12) },
  { ticker: "ASTS", company: "AST SpaceMobile", sector: "Communications", industry: "Satellite", marketCap: 5600000000, price: 18.45, change: 1.89, changePercent: 11.42, volume: 35000000, avgVolume: 15000000, analystCount: 5, gapScore: 79, activityScore: 93, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 38.00, low52w: 3.50, priceHistory: generatePriceHistory(18.45) },
  { ticker: "VKTX", company: "Viking Therapeutics", sector: "Healthcare", industry: "Biotechnology", marketCap: 8200000000, price: 72.34, change: 4.56, changePercent: 6.73, volume: 8900000, avgVolume: 4200000, analystCount: 8, gapScore: 71, activityScore: 85, opportunityType: "Sector Mispricing", pe: undefined, high52w: 99.00, low52w: 12.50, priceHistory: generatePriceHistory(72.34) },
  { ticker: "SMCI", company: "Super Micro Computer", sector: "Technology", industry: "Servers", marketCap: 18000000000, price: 32.45, change: -2.34, changePercent: -6.73, volume: 45000000, avgVolume: 22000000, analystCount: 7, gapScore: 68, activityScore: 96, opportunityType: "Institutional Blind Spot", pe: 15.2, high52w: 122.00, low52w: 18.00, priceHistory: generatePriceHistory(32.45) },
  { ticker: "RXRX", company: "Recursion Pharmaceuticals", sector: "Healthcare", industry: "AI Drug Discovery", marketCap: 3400000000, price: 10.23, change: 0.87, changePercent: 9.30, volume: 12000000, avgVolume: 6500000, analystCount: 6, gapScore: 74, activityScore: 84, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 18.50, low52w: 5.20, priceHistory: generatePriceHistory(10.23) },
  { ticker: "RKLB", company: "Rocket Lab USA", sector: "Industrial", industry: "Aerospace", marketCap: 11000000000, price: 22.56, change: 1.45, changePercent: 6.87, volume: 18000000, avgVolume: 9500000, analystCount: 7, gapScore: 72, activityScore: 88, opportunityType: "Sector Mispricing", pe: undefined, high52w: 27.00, low52w: 4.20, priceHistory: generatePriceHistory(22.56) },
  { ticker: "DNA", company: "Ginkgo Bioworks", sector: "Healthcare", industry: "Synthetic Biology", marketCap: 1800000000, price: 0.87, change: 0.05, changePercent: 6.10, volume: 25000000, avgVolume: 18000000, analystCount: 5, gapScore: 76, activityScore: 79, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 2.80, low52w: 0.45, priceHistory: generatePriceHistory(0.87) },
  { ticker: "LUNR", company: "Intuitive Machines", sector: "Industrial", industry: "Space", marketCap: 2100000000, price: 15.67, change: 2.34, changePercent: 17.55, volume: 32000000, avgVolume: 12000000, analystCount: 4, gapScore: 85, activityScore: 91, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 24.00, low52w: 3.80, priceHistory: generatePriceHistory(15.67) },
  { ticker: "JOBY", company: "Joby Aviation", sector: "Industrial", industry: "eVTOL", marketCap: 5800000000, price: 7.23, change: 0.45, changePercent: 6.64, volume: 15000000, avgVolume: 8500000, analystCount: 6, gapScore: 73, activityScore: 82, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 11.50, low52w: 4.20, priceHistory: generatePriceHistory(7.23) },
  { ticker: "SOUN", company: "SoundHound AI", sector: "Technology", industry: "AI/Voice", marketCap: 3200000000, price: 8.45, change: 0.78, changePercent: 10.17, volume: 42000000, avgVolume: 18000000, analystCount: 4, gapScore: 83, activityScore: 94, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 18.00, low52w: 1.50, priceHistory: generatePriceHistory(8.45) },
  { ticker: "BIRD", company: "Allbirds Inc", sector: "Consumer", industry: "Retail", marketCap: 180000000, price: 0.65, change: -0.03, changePercent: -4.41, volume: 5500000, avgVolume: 3200000, analystCount: 2, gapScore: 88, activityScore: 71, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 2.20, low52w: 0.42, priceHistory: generatePriceHistory(0.65) },
  { ticker: "DTC", company: "Solo Brands", sector: "Consumer", industry: "Outdoor", marketCap: 120000000, price: 0.78, change: 0.08, changePercent: 11.43, volume: 3800000, avgVolume: 1500000, analystCount: 1, gapScore: 93, activityScore: 74, opportunityType: "High Activity Low Coverage", pe: 8.5, high52w: 3.50, low52w: 0.55, priceHistory: generatePriceHistory(0.78) },
  { ticker: "AFRM", company: "Affirm Holdings", sector: "Finance", industry: "Fintech", marketCap: 16000000000, price: 52.34, change: 3.21, changePercent: 6.53, volume: 8500000, avgVolume: 4800000, analystCount: 12, gapScore: 62, activityScore: 81, opportunityType: "Sector Mispricing", pe: undefined, high52w: 75.00, low52w: 22.00, priceHistory: generatePriceHistory(52.34) },
  { ticker: "UPST", company: "Upstart Holdings", sector: "Finance", industry: "AI Lending", marketCap: 4800000000, price: 56.78, change: 4.56, changePercent: 8.73, volume: 6200000, avgVolume: 3500000, analystCount: 8, gapScore: 69, activityScore: 83, opportunityType: "Institutional Blind Spot", pe: 125.3, high52w: 85.00, low52w: 21.00, priceHistory: generatePriceHistory(56.78) },
  { ticker: "SOFI", company: "SoFi Technologies", sector: "Finance", industry: "Digital Banking", marketCap: 14000000000, price: 12.87, change: 0.54, changePercent: 4.38, volume: 32000000, avgVolume: 18000000, analystCount: 14, gapScore: 58, activityScore: 87, opportunityType: "Sector Mispricing", pe: 85.2, high52w: 17.50, low52w: 6.80, priceHistory: generatePriceHistory(12.87) },
  { ticker: "HOOD", company: "Robinhood Markets", sector: "Finance", industry: "Trading Platform", marketCap: 18500000000, price: 21.45, change: 1.23, changePercent: 6.08, volume: 15000000, avgVolume: 9000000, analystCount: 11, gapScore: 64, activityScore: 86, opportunityType: "Emerging Coverage Gap", pe: 42.5, high52w: 32.00, low52w: 8.50, priceHistory: generatePriceHistory(21.45) },
  { ticker: "RIVN", company: "Rivian Automotive", sector: "Consumer", industry: "Electric Vehicles", marketCap: 12500000000, price: 12.34, change: -0.67, changePercent: -5.15, volume: 28000000, avgVolume: 15000000, analystCount: 18, gapScore: 52, activityScore: 89, opportunityType: "Sector Mispricing", pe: undefined, high52w: 28.00, low52w: 8.50, priceHistory: generatePriceHistory(12.34) },
  { ticker: "LCID", company: "Lucid Group", sector: "Consumer", industry: "Electric Vehicles", marketCap: 7200000000, price: 2.45, change: 0.12, changePercent: 5.15, volume: 45000000, avgVolume: 28000000, analystCount: 12, gapScore: 56, activityScore: 91, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 8.50, low52w: 2.00, priceHistory: generatePriceHistory(2.45) },
  { ticker: "PLUG", company: "Plug Power", sector: "Energy", industry: "Hydrogen", marketCap: 2100000000, price: 2.34, change: 0.18, changePercent: 8.33, volume: 55000000, avgVolume: 32000000, analystCount: 9, gapScore: 61, activityScore: 92, opportunityType: "Sector Mispricing", pe: undefined, high52w: 8.00, low52w: 1.80, priceHistory: generatePriceHistory(2.34) },
  { ticker: "FCEL", company: "FuelCell Energy", sector: "Energy", industry: "Fuel Cells", marketCap: 380000000, price: 0.87, change: 0.05, changePercent: 6.10, volume: 18000000, avgVolume: 12000000, analystCount: 4, gapScore: 77, activityScore: 78, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 3.50, low52w: 0.65, priceHistory: generatePriceHistory(0.87) },
  { ticker: "BLDP", company: "Ballard Power", sector: "Energy", industry: "Fuel Cells", marketCap: 580000000, price: 1.92, change: 0.08, changePercent: 4.35, volume: 4500000, avgVolume: 2800000, analystCount: 6, gapScore: 75, activityScore: 72, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 5.20, low52w: 1.45, priceHistory: generatePriceHistory(1.92) },
  { ticker: "CLOV", company: "Clover Health", sector: "Healthcare", industry: "Health Insurance", marketCap: 420000000, price: 0.92, change: 0.07, changePercent: 8.24, volume: 8500000, avgVolume: 5200000, analystCount: 2, gapScore: 89, activityScore: 77, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 2.80, low52w: 0.65, priceHistory: generatePriceHistory(0.92) },
  { ticker: "TALK", company: "Talkspace Inc", sector: "Healthcare", industry: "Mental Health", marketCap: 280000000, price: 1.67, change: 0.12, changePercent: 7.74, volume: 2800000, avgVolume: 1200000, analystCount: 2, gapScore: 90, activityScore: 73, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 3.50, low52w: 1.10, priceHistory: generatePriceHistory(1.67) },
  { ticker: "BBAI", company: "BigBear.ai", sector: "Technology", industry: "AI/Defense", marketCap: 850000000, price: 3.45, change: 0.34, changePercent: 10.93, volume: 18000000, avgVolume: 8500000, analystCount: 3, gapScore: 86, activityScore: 88, opportunityType: "High Activity Low Coverage", pe: undefined, high52w: 6.80, low52w: 1.20, priceHistory: generatePriceHistory(3.45) },
  { ticker: "PLTR", company: "Palantir Technologies", sector: "Technology", industry: "Data Analytics", marketCap: 85000000000, price: 38.45, change: 2.12, changePercent: 5.84, volume: 65000000, avgVolume: 42000000, analystCount: 15, gapScore: 55, activityScore: 94, opportunityType: "Sector Mispricing", pe: 185.2, high52w: 45.00, low52w: 15.50, priceHistory: generatePriceHistory(38.45) },
  { ticker: "SNOW", company: "Snowflake Inc", sector: "Technology", industry: "Cloud Data", marketCap: 52000000000, price: 158.34, change: 5.67, changePercent: 3.71, volume: 4200000, avgVolume: 2800000, analystCount: 28, gapScore: 42, activityScore: 76, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 228.00, low52w: 107.00, priceHistory: generatePriceHistory(158.34) },
  { ticker: "NET", company: "Cloudflare Inc", sector: "Technology", industry: "Cloud Security", marketCap: 38000000000, price: 112.45, change: 3.21, changePercent: 2.94, volume: 3800000, avgVolume: 2500000, analystCount: 25, gapScore: 45, activityScore: 78, opportunityType: "Sector Mispricing", pe: 250.3, high52w: 132.00, low52w: 58.00, priceHistory: generatePriceHistory(112.45) },
  { ticker: "DDOG", company: "Datadog Inc", sector: "Technology", industry: "Monitoring", marketCap: 42000000000, price: 125.67, change: 4.32, changePercent: 3.56, volume: 2800000, avgVolume: 1800000, analystCount: 32, gapScore: 38, activityScore: 74, opportunityType: "Institutional Blind Spot", pe: 285.4, high52w: 152.00, low52w: 82.00, priceHistory: generatePriceHistory(125.67) },
  { ticker: "ZS", company: "Zscaler Inc", sector: "Technology", industry: "Cybersecurity", marketCap: 32000000000, price: 212.34, change: 8.45, changePercent: 4.14, volume: 1200000, avgVolume: 850000, analystCount: 28, gapScore: 41, activityScore: 72, opportunityType: "Sector Mispricing", pe: 312.5, high52w: 258.00, low52w: 142.00, priceHistory: generatePriceHistory(212.34) },
  { ticker: "CRWD", company: "CrowdStrike Holdings", sector: "Technology", industry: "Cybersecurity", marketCap: 78000000000, price: 325.67, change: 12.34, changePercent: 3.94, volume: 3200000, avgVolume: 2100000, analystCount: 35, gapScore: 35, activityScore: 81, opportunityType: "Institutional Blind Spot", pe: 485.2, high52w: 398.00, low52w: 200.00, priceHistory: generatePriceHistory(325.67) },
  { ticker: "OKTA", company: "Okta Inc", sector: "Technology", industry: "Identity", marketCap: 16500000000, price: 98.45, change: 2.87, changePercent: 3.00, volume: 1800000, avgVolume: 1200000, analystCount: 26, gapScore: 44, activityScore: 71, opportunityType: "Sector Mispricing", pe: undefined, high52w: 125.00, low52w: 65.00, priceHistory: generatePriceHistory(98.45) },
  { ticker: "MDB", company: "MongoDB Inc", sector: "Technology", industry: "Databases", marketCap: 18000000000, price: 245.67, change: 8.92, changePercent: 3.77, volume: 850000, avgVolume: 580000, analystCount: 24, gapScore: 46, activityScore: 73, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 485.00, low52w: 180.00, priceHistory: generatePriceHistory(245.67) },
  { ticker: "CELH", company: "Celsius Holdings", sector: "Consumer", industry: "Beverages", marketCap: 8500000000, price: 35.67, change: -1.23, changePercent: -3.33, volume: 5200000, avgVolume: 3800000, analystCount: 10, gapScore: 65, activityScore: 80, opportunityType: "Sector Mispricing", pe: 62.4, high52w: 98.00, low52w: 28.00, priceHistory: generatePriceHistory(35.67) },
  { ticker: "DKNG", company: "DraftKings Inc", sector: "Consumer", industry: "Gaming", marketCap: 18000000000, price: 38.45, change: 1.56, changePercent: 4.23, volume: 8500000, avgVolume: 5200000, analystCount: 22, gapScore: 48, activityScore: 84, opportunityType: "Emerging Coverage Gap", pe: undefined, high52w: 52.00, low52w: 25.00, priceHistory: generatePriceHistory(38.45) },
  { ticker: "PENN", company: "Penn Entertainment", sector: "Consumer", industry: "Gaming", marketCap: 2800000000, price: 17.23, change: 0.67, changePercent: 4.05, volume: 4500000, avgVolume: 2800000, analystCount: 14, gapScore: 59, activityScore: 76, opportunityType: "Institutional Blind Spot", pe: undefined, high52w: 32.00, low52w: 14.50, priceHistory: generatePriceHistory(17.23) },
  { ticker: "MARA", company: "Marathon Digital", sector: "Technology", industry: "Crypto Mining", marketCap: 6200000000, price: 21.34, change: 2.45, changePercent: 12.97, volume: 52000000, avgVolume: 28000000, analystCount: 5, gapScore: 80, activityScore: 96, opportunityType: "High Activity Low Coverage", pe: 18.5, high52w: 34.00, low52w: 8.50, priceHistory: generatePriceHistory(21.34) },
  { ticker: "RIOT", company: "Riot Platforms", sector: "Technology", industry: "Crypto Mining", marketCap: 3800000000, price: 12.45, change: 1.34, changePercent: 12.05, volume: 38000000, avgVolume: 22000000, analystCount: 5, gapScore: 81, activityScore: 95, opportunityType: "High Activity Low Coverage", pe: 24.2, high52w: 22.00, low52w: 6.80, priceHistory: generatePriceHistory(12.45) },
  { ticker: "CLSK", company: "CleanSpark Inc", sector: "Technology", industry: "Crypto Mining", marketCap: 3200000000, price: 14.56, change: 1.67, changePercent: 12.95, volume: 28000000, avgVolume: 15000000, analystCount: 4, gapScore: 84, activityScore: 93, opportunityType: "High Activity Low Coverage", pe: 22.1, high52w: 24.00, low52w: 5.50, priceHistory: generatePriceHistory(14.56) },
  { ticker: "WULF", company: "TeraWulf Inc", sector: "Technology", industry: "Crypto Mining", marketCap: 1800000000, price: 5.23, change: 0.67, changePercent: 14.69, volume: 32000000, avgVolume: 18000000, analystCount: 3, gapScore: 87, activityScore: 92, opportunityType: "High Activity Low Coverage", pe: 15.8, high52w: 8.50, low52w: 1.80, priceHistory: generatePriceHistory(5.23) },
  { ticker: "CORZ", company: "Core Scientific", sector: "Technology", industry: "Crypto Mining", marketCap: 4500000000, price: 15.67, change: 1.89, changePercent: 13.71, volume: 22000000, avgVolume: 12000000, analystCount: 4, gapScore: 83, activityScore: 91, opportunityType: "High Activity Low Coverage", pe: 19.2, high52w: 18.50, low52w: 2.50, priceHistory: generatePriceHistory(15.67) },
]

export const mockAlerts: Alert[] = [
  { id: "1", type: "gap_increase", severity: "high", ticker: "BTDR", message: "Gap score increased from 88 to 95 (+7 points)", timestamp: new Date(Date.now() - 1000 * 60 * 30), read: false },
  { id: "2", type: "volume_spike", severity: "high", ticker: "IONQ", message: "Volume spike detected: 3.2x average volume", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), read: false },
  { id: "3", type: "new_opportunity", severity: "medium", ticker: "SOUN", message: "New opportunity identified: High Activity Low Coverage", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), read: false },
  { id: "4", type: "coverage_change", severity: "low", ticker: "HIMS", message: "Analyst coverage changed: 4 → 5 analysts", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), read: true },
  { id: "5", type: "price_movement", severity: "medium", ticker: "LUNR", message: "Price moved +17.55% in single session", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), read: true },
  { id: "6", type: "gap_increase", severity: "high", ticker: "DTC", message: "Gap score increased from 85 to 93 (+8 points)", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), read: true },
  { id: "7", type: "volume_spike", severity: "medium", ticker: "MARA", message: "Volume spike detected: 1.9x average volume", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36), read: true },
  { id: "8", type: "new_opportunity", severity: "high", ticker: "WULF", message: "New opportunity identified: Institutional Blind Spot", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), read: true },
]

export const mockWatchlists: Watchlist[] = [
  { id: "1", name: "AI & Quantum", stocks: ["IONQ", "SOUN", "BBAI", "RXRX", "PLTR"], createdAt: new Date("2024-01-15") },
  { id: "2", name: "Crypto Mining", stocks: ["BTDR", "CIFR", "MARA", "RIOT", "CLSK", "WULF", "CORZ"], createdAt: new Date("2024-02-01") },
  { id: "3", name: "Space & Defense", stocks: ["LUNR", "RKLB", "ASTS", "JOBY"], createdAt: new Date("2024-02-20") },
]

export const mockHypothesis = {
  ticker: "BTDR",
  hypothesis: "Bitdeer Technologies presents a compelling asymmetric opportunity as a vertically integrated Bitcoin mining company with proprietary ASIC chip development capabilities. The company's transition from pure mining to chip manufacturing positions it uniquely in the industry, yet it remains significantly under-covered with only 2 analysts despite substantial institutional trading activity.",
  confidence: 78,
  bullCase: {
    title: "Bull Case",
    points: [
      "Proprietary SEAL chip technology provides cost advantages over competitors relying on third-party ASICs",
      "Diversified revenue streams from mining, cloud services, and chip sales",
      "Strategic partnerships with Tether and energy providers for expansion",
      "Bitcoin halving catalyst could drive industry consolidation favoring efficient operators"
    ]
  },
  baseCase: {
    title: "Base Case",
    points: [
      "Steady growth in mining capacity with gradual chip development progress",
      "Market share maintained as industry competition intensifies",
      "Energy costs remain manageable with existing partnerships"
    ]
  },
  bearCase: {
    title: "Bear Case",
    points: [
      "Bitcoin price decline could compress margins significantly",
      "Chip development delays or technical issues",
      "Regulatory crackdown on crypto mining operations",
      "Competition from larger, better-capitalized miners"
    ]
  },
  catalysts: [
    { event: "SEAL02 Chip Production Update", date: "Q1 2026" },
    { event: "Bitcoin Halving Effects", date: "April 2026" },
    { event: "New Mining Facility Opening", date: "Q2 2026" },
    { event: "Potential Analyst Initiation", date: "H1 2026" }
  ],
  risks: [
    { risk: "Bitcoin Price Volatility", severity: "high" as const },
    { risk: "Chip Development Execution", severity: "medium" as const },
    { risk: "Regulatory Environment", severity: "medium" as const },
    { risk: "Energy Cost Fluctuations", severity: "low" as const }
  ]
}

export function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString()}`
}

export function formatVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toLocaleString()
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
