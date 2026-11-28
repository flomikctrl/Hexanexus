import {duelRank} from './rating';
const assets={Бронза:'bronze',Серебро:'silver',Золото:'gold',Платина:'platinum',Алмаз:'diamond'} as const;
export function rankTrophy(cups:number){const name=duelRank(cups);return {name,src:`/assets/duels/ranks/${assets[name]}.svg`};}
