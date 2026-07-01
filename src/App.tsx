import { useState } from 'react';
import { useDiary } from './hooks/useDiary';
import { Calendar } from './components/Calendar';
import { DayView } from './components/DayView';
import { SettingsPanel } from './components/SettingsPanel';
import { todayISO } from './dateUtils';
import type { FoodItem, MealEntry, MealType } from './types';

export default function App() {
  const diary = useDiary();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [settingsOpen, setSettingsOpen] = useState(false);

  function handleAdd(meal: MealType, food: FoodItem, quantity: number) {
    const entry: MealEntry = { id: crypto.randomUUID(), food, quantity };
    diary.addEntry(selectedDate, meal, entry);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍎 Calorie Tracker</h1>
        <div className="header-actions">
          <button onClick={() => setSelectedDate(todayISO())}>Today</button>
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </header>

      <main className="app-main">
        <div className="calendar-column">
          <Calendar
            state={diary.state}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
        <div className="day-column">
          <DayView
            state={diary.state}
            date={selectedDate}
            onAdd={handleAdd}
            onRemove={(meal, id) => diary.removeEntry(selectedDate, meal, id)}
            onQuantityChange={(meal, id, qty) =>
              diary.updateEntryQuantity(selectedDate, meal, id, qty)
            }
          />
        </div>
      </main>

      {settingsOpen && (
        <SettingsPanel
          state={diary.state}
          onUpdateSettings={diary.updateSettings}
          onReplaceState={diary.replaceState}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
