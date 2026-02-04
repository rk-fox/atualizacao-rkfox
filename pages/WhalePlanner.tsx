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

    const proxy = "https://summer-night-03c0.rk-foxx-159.workers.dev/?";

    const convertPower = (value: number) => {
        const absValue = Math.abs(value);
        const sign = value < 0 ? '-' : '';
        if (absValue >= 1e9) return sign + (absValue / 1e9).toFixed(3).replace('.', ',') + ' Eh/s';
        if (absValue >= 1e6) return sign + (absValue / 1e6).toFixed(3).replace('.', ',') + ' Ph/s';
        if (absValue >= 1e3) return sign + (absValue / 1e3).toFixed(3).replace('.', ',') + ' Th/s';
        return sign + absValue.toFixed(3).replace('.', ',') + ' Gh/s';
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
                const ids2 = ["66e40f32e0dd3530da8bf7da", "674882691745a1e9ed4c3d56", "674882a81745a1e9ed4c3e66", "66e40f06e0dd3530da8bf564", "66e40f5de0dd3530da8bfa3a", "674882691745a1e9ed4c3d5e", "674882a81745a1e9ed4c3e6e"];
                const matching2 = miners.filter(m => ids2.includes(m.miner_id));
                const adj2 = matching2.length >= 3 ? 10 : (matching2.length >= 2 ? 5 : 0);
                matching2.forEach(m => m.setBonus += adj2);

                const idsRadio = ["693bd5f1b13b27427ba8a5c2", "693bd7d2b13b27427ba8af47", "693bd585b13b27427ba89ee7", "693bd705b13b27427ba8ac8e"];
                const matchingRadio = miners.filter(m => idsRadio.includes(m.miner_id));
                const adjRadio = matchingRadio.length === 4 ? 90 : (matchingRadio.length === 3 ? 60 : (matchingRadio.length === 2 ? 40 : 0));
                matchingRadio.forEach(m => m.setBonus += adjRadio);
            };

            applySets(processedMiners);

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

    const getLevelColor = (level: number) => {
        const colors = ['text-slate-500', 'text-green-500', 'text-blue-500', 'text-purple-500', 'text-yellow-500', 'text-red-500'];
        return colors[level] || 'text-slate-400';
    };

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
                            {minerImpacts.map((m, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedWhale(m)}
                                    className={`p-4 flex items-center gap-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-700/30 ${selectedWhale?.miner_id === m.miner_id ? 'bg-blue-50/50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''}`}
                                >
                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-lg flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-800">
                                        <img src={`https://static.rollercoin.com/static/img/market/miners/${m.filename}.gif?v=1`} alt="" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="font-black text-sm truncate dark:text-white uppercase leading-tight">{m.name}</div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                            <span className={getLevelColor(m.level)}>{m.type}</span>
                                            <span>•</span>
                                            <span>Sala {m.room_level + 1}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-red-500">{m.formattedImpact}</div>
                                        <div className="text-[10px] font-bold text-slate-400 capitalize">{m.level === 0 ? 'Common' : `Lvl ${m.level}`}</div>
                                    </div>
                                </div>
                            ))}
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
                                        <p className="text-xs font-black text-red-500">{selectedWhale.formattedImpact}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase text-center">Simular substituição por:</p>
                                <div className="relative">
                                    <select className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl outline-none appearance-none font-bold text-sm dark:text-white focus:ring-2 focus:ring-blue-500">
                                        <option>Selecione um minerador...</option>
                                        {dbMiners.slice(0, 100).map((m, i) => (
                                            <option key={i} value={m.name}>{m.name}</option>
                                        ))}
                                    </select>
                                    <LayoutGrid size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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