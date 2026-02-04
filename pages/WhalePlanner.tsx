import React, { useState, useEffect, useCallback } from 'react';
import { Search, Info, TrendingDown, LayoutGrid, RefreshCw, Trophy } from 'lucide-react';

interface DBItem {
    name: string;
    common: { power: number; bonus: number };
    uncommon: { power: number; bonus: number };
    rare: { power: number; bonus: number };
    epic: { power: number; bonus: number };
    legendary: { power: number; bonus: number };
    unreal: { power: number; bonus: number };
    legacy: { power: number; bonus: number };
}

interface RoomMiner {
    miner_id: string;
    user_rack_id: string;
    name: string;
    width: number;
    level: number;
    power: number;
    filename: string;
    bonus_percent: number;
    is_in_set: boolean;
    repetitions: string | number;
    setImpact: number;
    setBonus: number;
    type: string;
    sellable?: boolean;
    room_level: number;
    rack_x: number;
    rack_y: number;
    impact: number;
    formattedImpact: string;
}

export const WhalePlanner: React.FC = () => {
    const [userLink, setUserLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [dbMiners, setDbMiners] = useState<DBItem[]>([]);
    const [minerImpacts, setMinerImpacts] = useState<RoomMiner[]>([]);
    const [selectedWhale, setSelectedWhale] = useState<RoomMiner | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [simulationResult, setSimulationResult] = useState<{ impact: number; formatted: string } | null>(null);
    const [selectedNewMiner, setSelectedNewMiner] = useState<{ item: DBItem, level: string } | null>(null);
    const [userStats, setUserStats] = useState({ minersPower: 0, totalBonusPercent: 0, totalOrig: 0 });

    const proxy = "https://summer-night-03c0.rk-foxx-159.workers.dev/?";

    const convertPower = (value: number) => {
        const absValue = Math.abs(value);
        const sign = value < 0 ? '-' : '';
        if (absValue >= 1e9) return sign + (absValue / 1e9).toFixed(3).replace('.', ',') + ' EH/s';
        if (absValue >= 1e6) return sign + (absValue / 1e6).toFixed(3).replace('.', ',') + ' PH/s';
        if (absValue >= 1e3) return sign + (absValue / 1e3).toFixed(3).replace('.', ',') + ' TH/s';
        return sign + absValue.toFixed(3).replace('.', ',') + ' GH/s';
    };

    const loadDatabase = useCallback(async () => {
        const sheetId = "171LSMNAiJ74obfmLzueKtzuyu7Bg9Ql5dBWQ1GkjQTI";
        const apiKey = "AIzaSyBP12YfPrz9MhCH3J7boeondSm7HYVCUvA";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Database!C4:AP?key=${apiKey}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (!data.values) return;

            const items: DBItem[] = data.values.map((row: any) => ({
                name: row[0],
                common: { power: (parseFloat(row[1]) || 0) * 1000, bonus: parseFloat(row[2]) || 0 },
                uncommon: { power: (parseFloat(row[23]) || 0) * 1000, bonus: parseFloat(row[28]) || 0 },
                rare: { power: (parseFloat(row[24]) || 0) * 1000, bonus: parseFloat(row[29]) || 0 },
                epic: { power: (parseFloat(row[25]) || 0) * 1000, bonus: parseFloat(row[30]) || 0 },
                legendary: { power: (parseFloat(row[26]) || 0) * 1000, bonus: parseFloat(row[31]) || 0 },
                unreal: { power: (parseFloat(row[27]) || 0) * 1000, bonus: parseFloat(row[32]) || 0 },
                legacy: { power: (parseFloat(row[38]) || 0) * 1000, bonus: parseFloat(row[39]) || 0 }
            }));
            setDbMiners(items);
        } catch (e) {
            console.error("DB Load Error", e);
        }
    }, []);

    useEffect(() => {
        loadDatabase();
    }, [loadDatabase]);

    const handleSearch = async () => {
        if (!userLink) return;
        setLoading(true);

        try {
            // Profile & Power Data
            const profileRes = await fetch(`${proxy}https://rollercoin.com/api/profile/public-user-profile-data/${userLink}`);
            const profileData = await profileRes.json();
            const avatarId = profileData?.data?.avatar_id;

            if (!avatarId) throw new Error("Invalid User");

            const powerRes = await fetch(`${proxy}https://rollercoin.com/api/profile/user-power-data/${avatarId}`);
            const powerData = await powerRes.json();

            const minersPower = powerData.data.miners;
            let totalBonusPercent = powerData.data.bonus_percent;
            totalBonusPercent = parseFloat((totalBonusPercent / 100).toFixed(2));
            const totalOrig = minersPower * (1 + (totalBonusPercent / 100));

            // Room Config
            const roomRes = await fetch(`${proxy}https://rollercoin.com/api/game/room-config/${avatarId}`);
            const roomData = await roomRes.json();
            const rawMiners = roomData.data.miners;
            const rawRacks = roomData.data.racks;

            const minerCount: any = {};
            rawMiners.forEach((m: any) => {
                const key = `${m.miner_id}_${m.level}`;
                minerCount[key] = (minerCount[key] || 0) + 1;
            });

            const seen: any = {};
            let processedMiners: RoomMiner[] = rawMiners.map((m: any) => {
                const key = `${m.miner_id}_${m.level}`;
                const isFirst = !seen[key];
                seen[key] = true;

                const rack = rawRacks.find((r: any) => r._id === m.placement.user_rack_id);

                return {
                    miner_id: m.miner_id,
                    user_rack_id: m.placement.user_rack_id,
                    name: m.name,
                    width: m.width,
                    level: m.level,
                    power: m.power,
                    filename: m.filename,
                    bonus_percent: isFirst ? m.bonus_percent / 100 : 0,
                    is_in_set: m.is_in_set,
                    repetitions: isFirst ? "Não" : minerCount[key],
                    setImpact: 0,
                    setBonus: 0,
                    type: m.type,
                    room_level: rack?.placement?.room_level || 0,
                    rack_x: rack?.placement?.x || 0,
                    rack_y: rack?.placement?.y || 0,
                    impact: 0,
                    formattedImpact: ''
                };
            });

            // Set Adjustments (Ported logic)
            const applySets = (miners: RoomMiner[]) => {
                const applyAdj = (ids: string[], bFull: number, bPart: number, b3?: number) => {
                    const matches = miners.filter(m => ids.includes(m.miner_id));
                    let adj = 0;
                    if (b3 !== undefined) {
                        adj = matches.length === 4 ? bFull : (matches.length === 3 ? bPart : (matches.length === 2 ? b3 : 0));
                    } else {
                        adj = matches.length === ids.length ? bFull : (matches.length >= 2 ? bPart : 0);
                    }
                    matches.forEach(m => m.setBonus += adj);
                };

                const applyImpact = (ids: string[], iFull: number, iPart: number) => {
                    const matches = miners.filter(m => ids.includes(m.miner_id));
                    const adj = matches.length === ids.length ? iFull : (matches.length >= 2 ? iPart : 0);
                    matches.forEach(m => m.setImpact += adj);
                };

                // Imperial Set
                applyAdj(["66e40f32e0dd3530da8bf7da", "674882691745a1e9ed4c3d56", "674882a81745a1e9ed4c3e66", "66e40f06e0dd3530da8bf564", "66e40f5de0dd3530da8bfa3a", "674882691745a1e9ed4c3d5e", "674882a81745a1e9ed4c3e6e"], 10, 5);
                // Radio Set
                applyAdj(["693bd5f1b13b27427ba8a5c2", "693bd7d2b13b27427ba8af47", "693bd585b13b27427ba89ee7", "693bd705b13b27427ba8ac8e"], 90, 60, 40);
                // Designer Set
                applyAdj(["684947c1ccf7adb5d76505a6", "68626997411d00ff277d7a18", "686269fb411d00ff277d7b8d", "68626a8e411d00ff277d81cc", "68494781ccf7adb5d765052d", "68626962411d00ff277d76e9", "686269cb411d00ff277d7a80", "68626a5c411d00ff277d815a"], 24, 8);
                // Royal Set
                applyAdj(["6909e357dbb4b86eca7f24fa", "6909e3d4dbb4b86eca7f286c", "6909e466dbb4b86eca7f2928", "6909e329dbb4b86eca7f2489", "6909e395dbb4b86eca7f273b", "6909e466dbb4b86eca7f2925"], 24, 8);

                // Impact Sets
                applyImpact(["67338357d9b2852bde4b077d", "67338298d9b2852bde4afb0d", "67338415d9b2852bde4b0dc6"], 15000000, 7500000);
                applyImpact(["66c31b17b82bcb27662d302b", "66c31aecb82bcb27662d2f53", "66c31b3eb82bcb27662d30d8"], 10000000, 5000000);
                applyImpact(["66ead1cde0dd3530da969ea9", "66ead191e0dd3530da969e5f", "66ead1fbe0dd3530da969ef3"], 8000000, 5000000);
                applyImpact(["6687cea87643815232d65882", "6687cefd7643815232d65d11", "6687ce4e7643815232d65297", "6687ced67643815232d65cc8"], 3000000, 2000000);
                applyImpact(["6687cd307643815232d64077", "6687cdc47643815232d64726", "6687ccfc7643815232d6402d", "6687cd837643815232d640c1"], 2500000, 1500000);
            };

            applySets(processedMiners);

            setUserStats({ minersPower, totalBonusPercent, totalOrig });

            const finalImpacts = processedMiners.map(m => {
                const remainingPower = minersPower - m.power;
                const remainingBonus = totalBonusPercent - m.bonus_percent;
                const newAdjusted = remainingPower * ((100 + remainingBonus - m.setBonus) / 100);
                const impact = (newAdjusted - totalOrig) - m.setImpact;
                return { ...m, impact, formattedImpact: convertPower(impact) };
            }).sort((a, b) => b.impact - a.impact);

            setMinerImpacts(finalImpacts.slice(0, 10));

        } catch (e) {
            console.error(e);
            alert("Erro ao buscar dados do jogador.");
        } finally {
            setLoading(false);
        }
    };

    const getLevelInfo = (level: number, type: string) => {
        const levels = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Unreal', 'Legacy'];
        const colors = ['', 'text-green-500', 'text-blue-400', 'text-pink-500', 'text-yellow-400', 'text-red-500', 'text-orange-400'];

        let text = levels[level] || 'Unknown';
        let color = colors[level] || 'text-slate-400';

        if (level === 1) {
            if (type === 'merge') { text = 'Uncommon'; color = 'text-green-500'; }
            else if (type === 'old_merge') { text = 'Legacy'; color = 'text-orange-400'; }
        }

        return { text, color };
    };

    const handleSimulateUpdate = (miner: DBItem, level: string) => {
        if (!selectedWhale) return;

        const levelKey = level.toLowerCase() as keyof DBItem;
        const targetData = (miner[levelKey] as { power: number; bonus: number }) || { power: 0, bonus: 0 };

        const powerValue = targetData.power;
        const bonusValue = targetData.bonus;

        const { minersPower, totalBonusPercent, totalOrig } = userStats;
        const podervelho = selectedWhale.power;
        const bonusvelho = selectedWhale.bonus_percent; // This is already divided by 100 in processed minres

        // Formula from impact.js:
        // let newImpact = (((somaminer - podervelho + powerValue) * (1 + ((somabonus - bonusvelho*100 + bonusValue)/100))) - ((somaminer * (1 + (somabonus/100)))));
        const newImpact = (((minersPower - podervelho + powerValue) * (1 + ((totalBonusPercent - (bonusvelho * 100) + bonusValue) / 100))) - totalOrig);

        setSimulationResult({
            impact: newImpact,
            formatted: convertPower(newImpact)
        });
        setSelectedNewMiner({ item: miner, level });
    };

    const filteredMiners = dbMiners.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50);

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
                <div className="inline-flex p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl mb-4">
                    <Trophy size={32} />
                </div>
                <h2 className="font-display text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Whale Planner Pro</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">Identifique os mineradores de menor impacto e planeje substituições estratégicas</p>
            </div>

            {/* Search Bar */}
            <div className="bg-white dark:bg-dark-800 p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-2">
                <div className="flex-grow flex items-center px-4 gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-transparent focus-within:border-blue-500 transition-all">
                    <Search size={18} className="text-slate-400" />
                    <input
                        value={userLink}
                        onChange={(e) => setUserLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full py-4 bg-transparent outline-none text-slate-900 dark:text-white font-bold"
                        placeholder="Digite o ID do perfil ou nome do jogador..."
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                    {loading ? 'ANALISANDO...' : 'BUSCAR WHALE'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List Column */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                                <TrendingDown size={14} className="text-red-500" /> Top 10 Menor Impacto
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {minerImpacts.map((m, idx) => {
                                const levelInfo = getLevelInfo(m.level, m.type);
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setSelectedWhale(m);
                                            setSimulationResult(null);
                                            setSelectedNewMiner(null);
                                        }}
                                        className={`p-6 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-700/30 ${selectedWhale?.miner_id === m.miner_id ? 'bg-blue-50/50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}`}
                                    >
                                        <div className="flex flex-col md:flex-row gap-6">
                                            {/* Rank and Image */}
                                            <div className="flex flex-col items-center gap-2 w-full md:w-32 bg-slate-900/40 p-4 rounded-xl border border-slate-700">
                                                <span className="text-[10px] font-black uppercase text-slate-500">{idx + 1}º Lugar</span>
                                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-lg flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-800">
                                                    <img src={`https://static.rollercoin.com/static/img/market/miners/${m.filename}.gif?v=1`} alt="" className="w-full h-full object-contain" />
                                                </div>
                                                <div className="text-center">
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${levelInfo.color}`}>{levelInfo.text}</span>
                                                    <div className="font-black text-[11px] dark:text-white uppercase leading-tight mt-1">{m.name}</div>
                                                    <div className="text-[9px] font-bold text-red-500 mt-1 uppercase">Inegociável</div>
                                                </div>
                                            </div>

                                            {/* Data Table */}
                                            <div className="flex-grow grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-2">
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Poder</p>
                                                    <p className="text-xs font-bold dark:text-white">{convertPower(m.power)}</p>
                                                </div>
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Bônus</p>
                                                    <p className="text-xs font-bold text-blue-400">{(m.bonus_percent * 100).toFixed(2)}%</p>
                                                </div>
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Impacto Total</p>
                                                    <p className="text-xs font-bold text-red-500">{m.formattedImpact}</p>
                                                </div>
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Localização</p>
                                                    <p className="text-[9px] font-bold dark:text-slate-300">S: {m.room_level + 1}, L: {m.rack_y + 1}, R: {m.rack_x + 1}</p>
                                                </div>
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Faz parte de Set?</p>
                                                    <p className="text-[10px] font-bold dark:text-white">{m.setBonus > 0 || m.is_in_set ? 'Sim' : 'Não'}</p>
                                                </div>
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Repetida/Merge</p>
                                                    <p className="text-[10px] font-bold dark:text-white">{m.repetitions}</p>
                                                </div>
                                                <div className="bg-slate-900/20 p-2 rounded-lg border border-white/5 col-span-2">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Bônus de Set</p>
                                                    <p className="text-[10px] font-bold text-emerald-500">{m.setBonus > 0 ? `+${m.setBonus}%` : (m.setImpact > 0 ? convertPower(m.setImpact) : '0%')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {minerImpacts.length === 0 && !loading && (
                                <div className="py-20 text-center text-slate-300 dark:text-slate-600">
                                    <Search size={48} strokeWidth={1} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-widest">Busque um jogador para ver os impactos</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Simulation Column */}
                <div className="lg:col-span-1 space-y-6">
                    {selectedWhale ? (
                        <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-blue-500/5 sticky top-8">
                            <h3 className="text-center font-black uppercase text-sm mb-6 dark:text-white">Simulador de Troca</h3>

                            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 mb-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <img src={`https://static.rollercoin.com/static/img/market/miners/${selectedWhale.filename}.gif?v=1`} className="w-16 h-16 object-contain" alt="" />
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Miner Atual</p>
                                        <p className="font-black text-slate-800 dark:text-white leading-tight uppercase">{selectedWhale.name}</p>
                                        <p className="text-[10px] font-bold text-blue-500">+{selectedWhale.bonus_percent.toFixed(2)}% Bônus</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white dark:bg-dark-800 p-2 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Poder</p>
                                        <p className="text-xs font-black dark:text-white">{convertPower(selectedWhale.power)}</p>
                                    </div>
                                    <div className="bg-white dark:bg-dark-800 p-2 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Impacto</p>
                                        <p className="text-xs font-black text-red-500">-{convertPower(Math.abs(selectedWhale.impact))}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedNewMiner && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800 mb-6 animate-fade-in">
                                    <div className="flex items-center gap-4 mb-4">
                                        <img src={`https://static.rollercoin.com/static/img/market/miners/${selectedNewMiner.item.name.toLowerCase().replace(/\s+/g, '_')}.gif?v=1`} className="w-16 h-16 object-contain" alt="" />
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Simulação Nova</p>
                                            <p className="font-black text-slate-800 dark:text-white leading-tight uppercase text-xs">{selectedNewMiner.item.name}</p>
                                            <p className="text-[10px] font-black text-emerald-500 uppercase">{selectedNewMiner.level}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white dark:bg-dark-800 p-2 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Poder</p>
                                            <p className="text-xs font-black dark:text-white">{convertPower(selectedNewMiner.item[selectedNewMiner.level.toLowerCase() as keyof DBItem]?.power || 0)}</p>
                                        </div>
                                        <div className="bg-white dark:bg-dark-800 p-2 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Impacto Final</p>
                                            <p className={`text-xs font-black ${simulationResult?.impact && simulationResult.impact < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {simulationResult?.formatted || '0 PH/s'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 relative">
                                <p className="text-[10px] font-black text-slate-400 uppercase text-center">Simular substituição por:</p>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setIsDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl outline-none font-bold text-sm dark:text-white focus:ring-2 focus:ring-blue-500"
                                        placeholder="Pesquisar minerador..."
                                    />
                                    <LayoutGrid size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                                    {isDropdownOpen && searchTerm.length > 0 && (
                                        <div className="absolute z-50 bottom-full left-0 w-full mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                            {filteredMiners.map((m, i) => (
                                                <div key={i} className="p-2 border-b border-white/5 last:border-0">
                                                    <p className="text-[10px] font-black text-slate-500 px-2 pt-1">{m.name}</p>
                                                    <div className="flex flex-wrap gap-1 p-1">
                                                        {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Unreal', 'Legacy'].map(lvl => {
                                                            const d = m[lvl.toLowerCase() as keyof DBItem] as any;
                                                            if (!d || d.power === 0) return null;
                                                            return (
                                                                <button
                                                                    key={lvl}
                                                                    onClick={() => {
                                                                        handleSimulateUpdate(m, lvl);
                                                                        setIsDropdownOpen(false);
                                                                        setSearchTerm('');
                                                                    }}
                                                                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${getLevelInfo(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Unreal', 'Legacy'].indexOf(lvl), 'basic').color} hover:bg-white/10`}
                                                                >
                                                                    {lvl}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                                    <p className="text-[10px] font-black text-orange-600 uppercase mb-1 flex items-center gap-1">
                                        <Info size={10} /> Dica de Baleia
                                    </p>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                        Ao remover um minerador com bônus alto, o impacto negativo pode ser maior que o ganho bruto do novo minerador.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-8 rounded-3xl border-2 border-dashed border-blue-200 dark:border-blue-900/50 text-center flex flex-col items-center justify-center min-h-[400px]">
                            <Info size={32} className="text-blue-400 mb-4" />
                            <h4 className="font-display font-black text-slate-800 dark:text-white uppercase mb-2">Simulação de Troca</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Selecione um minerador da lista para ver os detalhes e simular trocas</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};