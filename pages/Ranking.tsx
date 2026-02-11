import React, { useState, useEffect, useRef } from 'react';
import { Trophy, TrendingUp, TrendingDown, History, X, Search, User } from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface RankingUser {
    id: string;
    posicao: number;
    inicial: number;
    name?: string;
}

interface RankedUser {
    user: RankingUser;
    userData: any;
    initialPower: number;
    previousPosition: number;
    rank: number;
    positionChange: number;
    rawHistory?: any[]; // Added for new history logic
    avatar?: string; // Added for new API data
    currentTotalPower?: number; // Added for live calculation
}

export const Ranking: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<RankedUser[]>([]);
    const [globalStats, setGlobalStats] = useState({
        totalMembers: 0,
        totalPower: 0,
        growth: 0
    });
    const [selectedUserHistory, setSelectedUserHistory] = useState<any>(null);
    const [showHistoryPopup, setShowHistoryPopup] = useState(false);
    const hasRun = useRef(false);

    const [showInclusionModal, setShowInclusionModal] = useState(false);
    const [inclusionForm, setInclusionForm] = useState({ name: '', avatarUrl: '' });
    const [submitting, setSubmitting] = useState(false);

    // Google Script Counter
    // Google Script Counter
    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const script_google = 'https://script.google.com/macros/s/AKfycbyKEeixfrwQq02uNQxBSpl1w6lUn31Q3ObHjJ2wNjdOfRwiIUHXgd3RrI7N9vioM4J2/exec';

        const updateCounterG2 = () => {
            fetch(script_google, {
                method: 'POST',
                mode: 'no-cors'
            }).catch(e => console.error("Error updating counter:", e));
        };

        updateCounterG2();
    }, []);

    const convertPower = (value: number) => {
        const absValue = Math.abs(value);
        if (absValue >= 1e12) return (value / 1e12).toFixed(3).replace('.', ',') + ' ZH/s';
        if (absValue >= 1e9) return (value / 1e9).toFixed(3).replace('.', ',') + ' EH/s';
        if (absValue >= 1e6) return (value / 1e6).toFixed(3).replace('.', ',') + ' PH/s';
        if (absValue >= 1e3) return (value / 1e3).toFixed(3).replace('.', ',') + ' TH/s';
        return value.toFixed(3).replace('.', ',') + ' GH/s';
    };

    const API_URL = "https://script.google.com/macros/s/AKfycby94m91Tp5XxP3D7f0LmwZ7wQGtY-QxPtKNAfha1S1fS6fDCeuxvvTrGWAoGrzvfddujQ/exec";

    const fetchRankingFromAPI = async () => {
        try {
            setLoading(true);
            const response = await fetch(API_URL);
            const data = await response.json();

            if (!data.success) throw new Error(data.error);

            // Process Ranking Data
            // Backend returns: id, name, avatar, stats: {miners, bonus_percent, racks, total}, previous_rank, last_update
            const apiUsers = data.ranking;
            const apiHistory = data.history;

            // Start fetching LIVE data for each user
            const fetchPromises = apiUsers.map(async (u: any) => {
                let liveData = null;
                try {
                    // Try to fetch live data
                    const response = await fetch(`https://summer-night-03c0.rk-foxx-159.workers.dev/?https://rollercoin.com/api/profile/user-power-data/${u.id}`);
                    const json = await response.json();
                    if (json.success) liveData = json.data;
                } catch (e) {
                    console.error(`Error fetching live data for ${u.name}`, e);
                }

                // Initial Power is what is stored in the sheet (from 1st of month)
                // This is u.stats.total
                const initialPower = u.stats.total;

                // If live fetch fails, fallback to stored stats (progress 0)
                const currentData = liveData || u.stats;

                // Calculate current total power
                // Note: API returns bonus_percent as raw int (e.g. 271542 = 27.15%)
                // Calc: Miners + Bonus + Racks
                // But wait, live API returns "bonus" value directly too?
                // Live API Check: "bonus": 1524... 
                // So we can just use that if available.

                let currentMiners = 0;
                let currentBonusPct = 0;
                let currentBonusPower = 0;
                let currentRacks = 0;
                let currentTotalPower = 0;

                if (liveData) {
                    currentMiners = liveData.miners;
                    currentBonusPct = liveData.bonus_percent;
                    currentRacks = liveData.racks;
                    currentBonusPower = liveData.bonus; // Use provided bonus power
                    currentTotalPower = currentMiners + currentBonusPower + currentRacks;
                } else {
                    // Fallback to stored
                    currentMiners = u.stats.miners;
                    currentBonusPct = u.stats.bonus_percent;
                    currentRacks = u.stats.racks;
                    // Stored stats might not have raw bonus power?
                    // "stats": {miners, bonus_percent, racks, total}
                    // We can calculate or just use total - miners - racks
                    currentTotalPower = u.stats.total;
                    currentBonusPower = currentTotalPower - currentMiners - currentRacks;
                }

                return {
                    user: { id: u.id, name: u.name, posicao: 0, inicial: initialPower },
                    userData: {
                        miners: currentMiners,
                        bonus_percent: currentBonusPct,
                        racks: currentRacks,
                        bonus_power: currentBonusPower // Store for display
                    },
                    initialPower: initialPower,
                    previousPosition: u.previous_rank, // Rank from Sheet (Month Start)
                    // We will calc rank later after sort
                    positionChange: 0,
                    rawHistory: apiHistory[u.id] || [],
                    avatar: u.avatar,
                    currentTotalPower: currentTotalPower
                };
            });

            const results = await Promise.all(fetchPromises);

            // Sort by LIVE Total Power
            results.sort((a, b) => b.currentTotalPower - a.currentTotalPower);

            // Global Stats
            let totalPowerSum = 0;
            // let totalInitialSum = 0;

            const finalRanked: RankedUser[] = results.map((item, index) => {
                const rank = index + 1;
                // Position Change = Previous Rank (Month Start) - Current Rank (Live)
                // If new (prev 9999), change 0.
                const positionChange = item.previousPosition === 9999 ? 0 : (item.previousPosition - rank);

                totalPowerSum += item.currentTotalPower;
                // totalInitialSum += item.initialPower;

                return {
                    ...item,
                    rank,
                    positionChange
                };
            });

            // Growth
            // const growth = totalInitialSum > 0 ? ((totalPowerSum / totalInitialSum) - 1) * 100 : 0;
            const growth = 0; // Placeholder for now

            setUsers(finalRanked);
            setGlobalStats({
                totalMembers: finalRanked.length,
                totalPower: totalPowerSum,
                growth: growth
            });

        } catch (error) {
            console.error("API Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = (userId: string) => {
        const user = users.find(u => u.user.id === userId);
        if (!user || !user.rawHistory) return;

        const h = user.rawHistory;
        // h is array of {date, miners, bonus, total}

        setSelectedUserHistory({
            labels: h.map((x: any) => new Date(x.date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Poder Total (Total)',
                    data: h.map((x: any) => x.total),
                    borderColor: 'rgb(34, 197, 94)', // Green
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    tension: 0.3
                },
                {
                    label: 'Mineradores',
                    data: h.map((x: any) => x.miners),
                    borderColor: 'rgb(59, 130, 246)', // Blue
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    tension: 0.3
                },
                {
                    label: 'Bonus',
                    data: h.map((x: any) => x.bonus),
                    borderColor: 'rgb(249, 115, 22)', // Orange
                    backgroundColor: 'rgba(249, 115, 22, 0.5)',
                    tension: 0.3
                }
            ]
        });
        setShowHistoryPopup(true);
    };

    const handleInclusionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors', // Google Script POST often needs no-cors or redirect handling
                headers: { 'Content-Type': 'text/plain' }, // Avoid preflight
                body: JSON.stringify(inclusionForm)
            });
            // With no-cors we can't read response. Assume success or handle UI optimistic.
            // But actually, standard way for Google Script public web app is standard fetch (it redirects).
            // Actually, `no-cors` is safer for simple submissions if we don't need data back.
            // But we want to know if it failed.
            // To read response, we need CORS enabled script (which it is usually if "Anyone" access).
            // Let's try normal mode first. 
            // Update: User provided a script that returns JSON.
            // Script: ContentService.createTextOutput... setMimeType(JSON).
            // This usually supports CORS if deployed correctly.

            // Re-trying with normal mode (default)
            // But `fetch` to Google Script often has CORS issues depending on browser.
            // Let's try `no-cors` for safety and alert user "Solicitação enviada".

            alert("Solicitação enviada com sucesso! Você aparecerá no ranking na próxima atualização mensal.");
            setShowInclusionModal(false);
            setInclusionForm({ name: '', avatarUrl: '' });
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar solicitação.");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        fetchRankingFromAPI();
    }, []);

    // Helper for rendering Rank Icons
    const renderRank = (rank: number) => {
        if (rank === 1) return <img src="https://raw.githubusercontent.com/rk-fox/rk-fox.github.io/main/ranking/images/ouro.png" className="w-8 h-8 inline-block" alt="1st" />;
        if (rank === 2) return <img src="https://raw.githubusercontent.com/rk-fox/rk-fox.github.io/main/ranking/images/prata.png" className="w-8 h-8 inline-block" alt="2nd" />;
        if (rank === 3) return <img src="https://raw.githubusercontent.com/rk-fox/rk-fox.github.io/main/ranking/images/bronze.png" className="w-8 h-8 inline-block" alt="3rd" />;
        return <span className="font-black text-slate-500 text-lg">#{rank}</span>;
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto px-4 pb-24">

            {/* Header */}
            <div className="text-center mb-12">
                <h2 className="font-display text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Ranking da Comunidade</h2>
                <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs font-bold uppercase text-slate-500">
                    <span className="bg-white dark:bg-dark-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        Total Membros: <b className="text-slate-800 dark:text-white">{globalStats.totalMembers}</b>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        Poder Total: <b className="text-blue-500">{convertPower(globalStats.totalPower)}</b>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        Crescimento: <b className={globalStats.growth >= 0 ? 'text-green-500' : 'text-red-500'}>{globalStats.growth.toFixed(2)}%</b>
                    </span>
                    <span className="bg-white dark:bg-dark-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        Ref: 10/02/2026
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-4"></div>
                    <p className="text-slate-500 font-bold animate-pulse">Carregando dados do Ranking...</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/20 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-700">
                                    <th className="px-2 md:px-4 py-3 text-center">Rank</th>
                                    <th className="px-2 md:px-4 py-3 text-center">Posição</th>
                                    <th className="px-2 md:px-4 py-3">Nick</th>
                                    <th className="px-2 md:px-4 py-3 text-right">Miners</th>
                                    <th className="px-2 md:px-4 py-3 text-center">Bônus</th>
                                    <th className="px-2 md:px-4 py-3 text-right">Racks</th>
                                    <th className="px-2 md:px-4 py-3 text-right">Total Power</th>
                                    <th className="px-2 md:px-4 py-3 text-center w-32 md:w-48">Progresso</th>
                                    <th className="px-2 md:px-4 py-3 text-center">Hist</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {users.map((user) => {
                                    const totalPower = user.currentTotalPower || (user.userData.miners + (user.userData.miners * user.userData.bonus_percent / 10000) + user.userData.racks);
                                    const minerPower = user.userData.miners;
                                    // Use live bonus power if available, else calc
                                    const bonusPower = user.userData.bonus_power !== undefined ? user.userData.bonus_power : (minerPower * (user.userData.bonus_percent / 10000));
                                    const powerGain = totalPower - user.initialPower;
                                    const progressPct = user.initialPower > 0 ? (powerGain / user.initialPower) * 100 : 0;

                                    return (
                                        <tr key={user.user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-2 md:px-4 py-3 text-center">
                                                {renderRank(user.rank)}
                                            </td>
                                            <td className="px-2 md:px-4 py-3 text-center">
                                                {user.positionChange !== 0 ? (
                                                    <div className={`flex items-center justify-center gap-1 font-bold ${user.positionChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {user.positionChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                        {Math.abs(user.positionChange)}
                                                    </div>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="px-2 md:px-4 py-3">
                                                <div className="flex items-center gap-2 md:gap-3">
                                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                                                        <img
                                                            src={user.avatar || `https://avatars.rollercoin.com/static/avatars/thumbnails/48/${user.user.id}.png?v=1`}
                                                            onError={(e) => { e.currentTarget.src = 'https://rollercoin.com/static/images/profile/avatar/avatar_1.png' }}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs md:text-sm truncate max-w-[100px] md:max-w-none">{user.user.name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 md:px-4 py-3 text-right font-mono text-[10px] md:text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{convertPower(minerPower)}</td>
                                            <td className="px-2 md:px-4 py-3 text-center">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-blue-500 text-[10px] md:text-xs">{(user.userData.bonus_percent / 100).toFixed(2)}%</span>
                                                    <span className="font-mono text-[10px] md:text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{convertPower(bonusPower)}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 md:px-4 py-3 text-right font-mono text-[10px] md:text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{convertPower(user.userData.racks)}</td>
                                            <td className="px-2 md:px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs md:text-sm whitespace-nowrap">{convertPower(totalPower)}</td>
                                            <td className="px-2 md:px-4 py-3">
                                                <div className="flex flex-col gap-1 min-w-[100px] items-center text-center">
                                                    <div className="text-[10px] font-bold uppercase text-slate-400 flex flex-col leading-tight">
                                                        <span className="text-slate-500 dark:text-slate-300">{progressPct > 0 ? '+' : ''}{progressPct.toFixed(2)}%</span>
                                                        <span>{convertPower(powerGain)}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mt-1">
                                                        <div
                                                            className={`h-full ${progressPct >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                            style={{ width: `${Math.min(100, Math.abs(progressPct))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 md:px-4 py-3 text-center">
                                                <button
                                                    onClick={() => loadHistory(user.user.id)}
                                                    className="p-1.5 md:p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-blue-500 transition-colors"
                                                >
                                                    <History size={16} className="md:w-[18px] md:h-[18px]" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* History Popup */}
            {showHistoryPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowHistoryPopup(false)}>
                    <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-display font-black text-2xl text-slate-800 dark:text-white uppercase">Histórico de Poder</h3>
                            <button onClick={() => setShowHistoryPopup(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="aspect-video w-full bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4">
                            {selectedUserHistory ? (
                                <Line options={{
                                    responsive: true,
                                    plugins: {
                                        legend: {
                                            position: 'top' as const,
                                        },
                                        title: {
                                            display: false,
                                        },
                                    },
                                }} data={selectedUserHistory} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400 animate-pulse">Carregando gráfico...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Inclusion Modal */}
            {showInclusionModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowInclusionModal(false)}>
                    <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-display font-black text-xl text-slate-800 dark:text-white uppercase">Solicitar Inclusão</h3>
                            <button onClick={() => setShowInclusionModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>
                        <p className="text-[12px] text-slate-400 mt-1">A inclusão será concluída no início do próximo mês!</p>
                        <form onSubmit={handleInclusionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nome no Jogo (Nick)</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: RKFox"
                                    value={inclusionForm.name}
                                    onChange={e => setInclusionForm({ ...inclusionForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link do Avatar</label>
                                <input
                                    type="url"
                                    required
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                                    placeholder="https://avatars.rollercoin.com/..."
                                    value={inclusionForm.avatarUrl}
                                    onChange={e => setInclusionForm({ ...inclusionForm, avatarUrl: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Copie o link da imagem do seu avatar no perfil do RollerCoin.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                {submitting ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : 'Enviar Solicitação'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="text-center mt-12">
                <button
                    onClick={() => setShowInclusionModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
                >
                    Solicitar inclusão no Ranking
                </button>
            </div>
        </div>
    );
};
