import type { DiaryState } from '../types';
import { dayCalories } from '../types';
import { kgToLb } from '../nutrition';
import { todayISO } from '../dateUtils';

export type ScreenView = 'diary' | 'profile' | 'body' | 'recipes' | 'settings';

interface DashboardProps {
  state: DiaryState;
  goal: number;
  onNavigate: (view: ScreenView) => void;
}

/** Landing screen: a grid of tiles with a quick stat, each opening a section. */
export function Dashboard({ state, goal, onNavigate }: DashboardProps) {
  const eaten = dayCalories(state.days[todayISO()]);
  const remaining = goal - eaten;

  const latest = [...(state.bodyScans ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  const units = state.settings.profile.units;
  const bodyStat = latest
    ? latest.weightKg != null
      ? `${units === 'imperial' ? Math.round(kgToLb(latest.weightKg) * 10) / 10 : Math.round(latest.weightKg * 10) / 10} ${units === 'imperial' ? 'lb' : 'kg'}`
      : latest.bodyFatPct != null ? `${latest.bodyFatPct}% body fat` : 'Scan logged'
    : 'Add your first';

  const tiles: { view: ScreenView; icon: string; title: string; stat: string }[] = [
    { view: 'diary', icon: '📅', title: "Today's Diary", stat: `${eaten} / ${goal} cal · ${remaining >= 0 ? `${remaining} left` : `${-remaining} over`}` },
    { view: 'body', icon: '📊', title: 'Body Scans', stat: bodyStat },
    { view: 'profile', icon: '👤', title: 'Profile', stat: `Goal ${goal} cal/day` },
    { view: 'recipes', icon: '🍳', title: 'Recipes', stat: `${state.recipes.length} saved` },
    { view: 'settings', icon: '⚙️', title: 'Settings', stat: 'Goals, backups, data' },
  ];

  return (
    <div className="dashboard">
      {tiles.map((t) => (
        <button key={t.view} className="dash-tile" onClick={() => onNavigate(t.view)}>
          <span className="dash-icon" aria-hidden>{t.icon}</span>
          <span className="dash-title">{t.title}</span>
          <span className="dash-stat">{t.stat}</span>
        </button>
      ))}
    </div>
  );
}
