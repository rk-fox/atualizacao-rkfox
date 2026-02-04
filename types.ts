export interface CryptoEarning {
    token: string;
    block: string;
    day: string;
    month: string;
    withdraw: string | number;
}

export interface Miner {
    id: number;
    name: string;
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Unreal';
    power: number;
    bonus: number;
    qty: number;
    unitPrice: number;
    totalPrice: number;
}

export interface WhaleItem {
    id: number;
    rank: number;
    name: string;
    image: string;
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Unreal';
    marketStatus: 'Negociável' | 'Inegociável';
    power: string;
    bonus: string;
    impactValue: string; // The calculated impact string e.g. "-311,634 Phs"
    location: string;
    isSet: boolean; // For 1st place
    isRepeated: boolean; // For 2nd place onwards
}