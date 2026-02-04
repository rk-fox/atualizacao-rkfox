import React, { useState, useEffect } from 'react';
import { Link2, LayoutList, RefreshCcw, Calculator, Flame, Info } from 'lucide-react';

interface ParsedMiner {
    level: number;
    name: string;
    set: string;
    size: number;
    power: number;
    bonus: number;
    quantity: number;
    points?: number;
}

export const BurnPlanner: React.FC = () => {
    const [userLink, setUserLink] = useState('');
    const [inventoryData, setInventoryData] = useState('');
    const [ptsTHs, setPtsTHs] = useState<number>(100);
    const [ptsBonus, setPtsBonus] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [miners, setMiners] = useState<ParsedMiner[]>([]);

    const [stats, setStats] = useState({
        totalPoints: 0,
        totalPower: 0,
        totalBonus: 0,
        minersCount: 0
    });

    const formatPower = (ghs: number) => {
        if (ghs >= 1e6) return `${(ghs / 1e6).toFixed(2)} PH/s`;
        if (ghs >= 1e3) return `${(ghs / 1e3).toFixed(2)} TH/s`;
        return `${ghs.toFixed(2)} GH/s`;
    };

    const handleOrganize = async () => {
        if (!userLink && !inventoryData) {
            alert("Por favor, insira o link do perfil ou os dados do inventário.");
            return;
        }

        setLoading(true);
        let allMiners: ParsedMiner[] = [];

        try {
            // 1. API Fetching (Room Miners)
            if (userLink) {
                const proxy = "https://summer-night-03c0.rk-foxx-159.workers.dev/?";
                const profileUrl = `${proxy}https://rollercoin.com/api/profile/public-user-profile-data/${userLink}`;
                const profileRes = await fetch(profileUrl);
                const profileData = await profileRes.json();
                const avatarId = profileData?.data?.avatar_id;

                if (avatarId) {
                    const roomUrl = `${proxy}https://rollercoin.com/api/game/room-config/${avatarId}`;
                    const roomRes = await fetch(roomUrl);
                    const roomData = await roomRes.json();
                    const roomMiners = roomData?.data?.miners || [];

                    roomMiners.forEach((m: any) => {
                        allMiners.push({
                            level: m.level,
                            name: m.name,
                            set: 'Room',
                            size: 1, // Simplified
                            power: m.power,
                            bonus: m.bonus_percent / 100,
                            quantity: 1
                        });
                    });
                }
            }

            // 2. Text Parsing (Inventory)
            if (inventoryData) {
                let cleaned = inventoryData.split(/open\s*/)
                    .map((p, i) => {
                        let part = p.trim();
                        if (!part) return "";
                        if (i === 0) return part.match(/^\d/) ? `Level ${part}` : `Level 0 ${part}`;
                        return part.match(/^\d/) ? `Level ${part}` : `Level 0 ${part}`;
                    })
                    .join(" open ")
                    .replace(/(set badge|Cells|Miner details|open)/g, "")
                    .replace(/\s+/g, " ")
                    .replace(/\r?\n|\r/g, "")
                    .trim();

                const regex = /Level\s+(\d+)\s+([A-Za-z0-9\s\-\']+?)\s+Set\s+([A-Za-z0-9\s\-\']+?)\s+Size:\s+(\d+)\s+Power\s+([\d.,]+)\s+(Th\/s|Ph\/s|Gh\/s|Eh\/s)\s+Bonus\s+([\d.]+)\s+%\s+Quantity:\s+(\d+)\s+(Can(?:'t)?\sbe\sSold)/gm;

                let match;
                while ((match = regex.exec(cleaned)) !== null) {
                    let pwr = parseFloat(match[5].replace(',', '.'));
                    const unit = match[6];
                    if (unit === "Eh/s") pwr *= 1e9;
                    else if (unit === "Ph/s") pwr *= 1e6;
                    else if (unit === "Th/s") pwr *= 1e3;

                    allMiners.push({
                        level: parseInt(match[1]),
                        name: match[2].trim(),
                        set: match[3].trim(),
                        size: parseInt(match[4]),
                        power: pwr,
                        bonus: parseFloat(match[7]),
                        quantity: parseInt(match[8])
                    });
                }
            }

            // 3. Deduplicate and Calculate
            const merged = allMiners.reduce((acc: ParsedMiner[], curr) => {
                const existing = acc.find(m => m.name === curr.name && m.level === curr.level);
                if (existing) {
                    existing.quantity += curr.quantity;
                } else {
                    acc.push({ ...curr });
                }
                return acc;
            }, []);

            const finalMiners = merged.map(m => ({
                ...m,
                points: ((m.power / 1000) * ptsTHs) + (m.bonus * ptsBonus)
            })).sort((a, b) => (b.points || 0) - (a.points || 0));

            setMiners(finalMiners);

            // Stats
            const totalP = finalMiners.reduce((acc, m) => acc + (m.power * m.quantity), 0);
            const totalB = finalMiners.reduce((acc, m) => acc + (m.bonus * m.quantity), 0);
            const totalPts = finalMiners.reduce((acc, m) => acc + ((m.points || 0) * m.quantity), 0);

            setStats({
                totalPoints: totalPts,
                totalPower: totalP,
                totalBonus: totalB,
                minersCount: finalMiners.reduce((acc, m) => acc + m.quantity, 0)
            });

        } catch (error) {
            console.error(error);
            alert("Erro ao processar os dados. Verifique os campos e tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setMiners([]);
        setInventoryData('');
        setUserLink('');
        setStats({ totalPoints: 0, totalPower: 0, totalBonus: 0, minersCount: 0 });
    };

    const getRarityColor = (level: number) => {
        switch (level) {
            case 0: return 'text-slate-500';
            case 1: return 'text-green-500';
            case 2: return 'text-blue-500';
            case 3: return 'text-purple-500';
            case 4: return 'text-yellow-500';
            case 5: return 'text-red-500';
            default: return 'text-slate-400';
        }
    };

    const getRarityName = (level: number) => {
        const names = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Unreal'];
        return names[level] || 'Basic';
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
                <div className="inline-flex p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl mb-4">
                    <Flame size={32} />
                </div>
                <h2 className="font-display text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Planejador de Queima</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">Sincronize sua sala e inventário para maximizar seus pontos no evento</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Inputs Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
                            <Calculator size={14} /> Configuração de Entrada
                        </h3>

                        <div className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 mb-2">
                                    <Link2 size={14} /> ID do Perfil / Link
                                </label>
                                <input
                                    value={userLink}
                                    onChange={(e) => setUserLink(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                    placeholder="Ex: RKFox ou Link Completo"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 mb-2">
                                    <LayoutList size={14} /> Dados do Inventário
                                </label>
                                <textarea
                                    value={inventoryData}
                                    onChange={(e) => setInventoryData(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none text-xs font-mono"
                                    placeholder="Copie e cole os dados do inventário aqui..."
                                />
                            </div>

                            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-200/50 dark:border-orange-900/30">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[10px] font-black uppercase text-orange-600">Pontuação do Evento</h4>
                                    <Info size={12} className="text-orange-400 cursor-help" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Pts / THs</label>
                                        <input
                                            type="number"
                                            value={ptsTHs}
                                            onChange={(e) => setPtsTHs(Number(e.target.value))}
                                            className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-center text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Pts / % Bônus</label>
                                        <input
                                            type="number"
                                            value={ptsBonus}
                                            onChange={(e) => setPtsBonus(Number(e.target.value))}
                                            className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-center text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleOrganize}
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98]"
                            >
                                {loading ? 'Processando...' : 'ORGANIZAR QUEIMA'}
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats Summary */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total de Pontos</p>
                            <p className="text-lg font-black text-orange-600 leading-none">
                                {stats.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-dark-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Poder em Miner</p>
                            <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
                                {formatPower(stats.totalPower)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Results Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] flex flex-col">
                        <div className="bg-slate-900 dark:bg-black px-6 py-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <LayoutList size={18} className="text-orange-500" />
                                <h3 className="text-white font-black uppercase tracking-widest text-xs">Minérios Consolidados</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{miners.length} Tipos</span>
                                <button
                                    onClick={handleReset}
                                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px] font-black uppercase transition-colors"
                                >
                                    <RefreshCcw size={12} /> Limpar
                                </button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-x-auto custom-scrollbar">
                            {miners.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                            <th className="px-6 py-4">Minerador</th>
                                            <th className="px-6 py-4 text-center">Poder</th>
                                            <th className="px-6 py-4 text-center">Bônus</th>
                                            <th className="px-6 py-4 text-center">Pontos Est.</th>
                                            <th className="px-6 py-4 text-right">Qtd</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {miners.map((miner, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-black text-sm dark:text-white group-hover:text-orange-600 transition-colors">{miner.name}</div>
                                                    <div className={`text-[10px] font-black uppercase tracking-tight ${getRarityColor(miner.level)}`}>
                                                        {getRarityName(miner.level)} • {miner.set}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="text-xs font-bold dark:text-slate-300">{formatPower(miner.power)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="text-xs font-bold text-blue-500">+{miner.bonus}%</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="text-xs font-black text-orange-600">
                                                        {(miner.points || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} pts
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-black dark:text-white">
                                                        x{miner.quantity}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-300 dark:text-slate-600">
                                    <Flame size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Nenhum dado processado</p>
                                    <p className="text-xs">Insira os dados à esquerda para começar</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};