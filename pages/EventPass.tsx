import React, { useState, useEffect } from 'react';
import { Gift, Search, Info, Award, Zap, Coins, Box, ChevronRight, TrendingUp, Trophy } from 'lucide-react';

interface EventReward {
    id: string;
    type: string;
    amount: number;
    currency?: string;
    required_level: number;
    item?: {
        name: { en: string };
        power: number;
        filename: string;
        bonus: number;
        level: number;
        _id: string;
    };
}

export const EventPass: React.FC = () => {
    const [base64, setBase64] = useState("");
    const [eventData, setEventData] = useState<any>(null);
    const [stats, setStats] = useState({
        totalXP: 0,
        totalPower: 0,
        totalBonus: 0,
        totalRLT: 0,
        totalRST: 0
    });

    const levelNames = ["Comum", "Incomum", "Rara", "Épica", "Lendária", "Unreal"];

    const formatPower = (value: number) => {
        if (value >= 1e6) return `${(value / 1e6).toFixed(2)} PH/s`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(2)} TH/s`;
        return `${value} GH/s`;
    };

    const decodeEvent = (b64: string) => {
        try {
            const decoded = JSON.parse(atob(b64));
            setEventData(decoded);

            let xp = 0;
            let pwr = 0;
            let bns = 0;
            let rlt = 0;
            let rst = 0;

            const xpMap = (decoded.levels_config || []).reduce((acc: any, l: any) => {
                acc[l.level] = l.level_xp;
                return acc;
            }, {});

            decoded.rewards.forEach((r: EventReward) => {
                xp += xpMap[r.required_level] || 0;
                if (r.type === 'miner') {
                    pwr += r.item?.power || 0;
                    bns += (r.item?.bonus || 0) / 100;
                }
                if (r.type === 'money') {
                    if (r.currency === 'RLT') rlt += r.amount / 1000000;
                    if (r.currency === 'RST') rst += r.amount / 1000000;
                }
            });

            setStats({
                totalXP: xp,
                totalPower: pwr,
                totalBonus: bns,
                totalRLT: rlt,
                totalRST: rst
            });
        } catch (e) {
            console.error(e);
            if (b64) alert("Erro ao decodificar código do evento.");
        }
    };

    const getRewardImage = (reward: EventReward) => {
        if (reward.type === 'money') {
            return reward.currency === 'RLT'
                ? 'https://rollercoin.com/static/img/seasonPass/reward_RLT.png'
                : 'https://rollercoin.com/static/img/seasonPass/reward_RST.png';
        }
        if (reward.type === 'miner') {
            return `https://static.rollercoin.com/static/img/market/miners/${reward.item?.filename}.gif`;
        }
        if (reward.type === 'power') {
            return 'https://rollercoin.com/static/img/seasonPass/reward_power.png';
        }
        if (reward.type === 'rack') {
            return `https://static.rollercoin.com/static/img/market/racks/${reward.item?._id}.png`;
        }
        return '';
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4 pb-20">
            <div className="text-center mb-12">
                <div className="inline-flex p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl mb-4">
                    <Gift size={32} />
                </div>
                <h2 className="font-display text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Event Pass Rewards</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">Analise as recompensas e o progresso dos eventos do RollerCoin</p>
            </div>

            {/* Base64 Input */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-black uppercase text-slate-500 mb-4 px-1 flex items-center gap-2">
                    <Award size={14} /> Código do Evento (Base64)
                </label>
                <div className="flex flex-col md:flex-row gap-4">
                    <textarea
                        value={base64}
                        onChange={(e) => setBase64(e.target.value)}
                        className="flex-grow p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none h-24 lg:h-32 resize-none"
                        placeholder="Cole aqui o código Base64 do evento..."
                    />
                    <button
                        onClick={() => decodeEvent(base64)}
                        className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap self-stretch md:self-end h-fit"
                    >
                        Analisar Evento
                    </button>
                </div>
            </div>

            {eventData && (
                <div className="space-y-10">
                    {/* Header Info */}
                    <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4">
                            <Trophy size={300} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-3xl lg:text-5xl font-black uppercase mb-4 tracking-tighter">
                                {eventData.event?.title?.en || "Evento Desconhecido"}
                            </h3>
                            <div className="flex flex-wrap gap-6 mt-8">
                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase opacity-60 mb-1">Poder Total</p>
                                    <p className="text-2xl font-black">{formatPower(stats.totalPower)}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase opacity-60 mb-1">Bônus Total</p>
                                    <p className="text-2xl font-black">{stats.totalBonus.toFixed(2)}%</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase opacity-60 mb-1">Rewards (RLT)</p>
                                    <p className="text-2xl font-black text-yellow-400">{stats.totalRLT.toFixed(2)}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl">
                                    <p className="text-[10px] font-black uppercase opacity-60 mb-1">Total XP</p>
                                    <p className="text-2xl font-black">{stats.totalXP.toLocaleString('pt-BR')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rewards Table */}
                    <div className="bg-white dark:bg-dark-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Nível</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Recompensa</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Poder</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Bônus</th>
                                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Impacto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {eventData.rewards.map((r: EventReward, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-6">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-black text-sm dark:text-white">
                                                    {r.required_level}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-2 flex items-center justify-center">
                                                        <img src={getRewardImage(r)} className="w-full h-full object-contain" alt="" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black dark:text-white uppercase leading-tight">
                                                            {r.type === 'money' ? `${(r.amount / 1000000).toFixed(2)} ${r.currency}` :
                                                                r.type === 'miner' ? r.item?.name?.en :
                                                                    r.type === 'power' ? `${(r.amount / 1000000).toFixed(2)} PH/s` :
                                                                        r.type === 'rack' ? r.item?.name?.en : '---'}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                            {r.type === 'miner' ? levelNames[r.item?.level || 0] : r.type}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <span className="text-sm font-black dark:text-white">
                                                    {r.type === 'miner' ? formatPower(r.item?.power || 0) : '---'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6">
                                                <span className="text-sm font-black text-blue-500">
                                                    {r.type === 'miner' && r.item?.bonus ? `+${(r.item.bonus / 100).toFixed(2)}%` : '---'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-1 text-emerald-500">
                                                    {r.type === 'miner' && <TrendingUp size={14} />}
                                                    <span className="text-sm font-black">
                                                        {r.type === 'miner' ? `+${r.item?.power ? (r.item.power / 1000).toFixed(1) : 0} TH` : '---'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
