// index.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

function App() {
  // Основные состояния: инициализация, исходные данные, данные по дням и текущий режим отображения
  const [initialized, setInitialized] = useState(false);
  const [salary, setSalary] = useState('');
  const [mandatoryExpenses, setMandatoryExpenses] = useState('');
  const [startDate, setStartDate] = useState('');
  const [daysData, setDaysData] = useState([]); // Массив объектов для каждого дня
  const [activeView, setActiveView] = useState("daily"); // 'daily' – ежедневный режим, 'monthly' – таблица месяца
  const [currentDayIndex, setCurrentDayIndex] = useState(0);  // Индекс текущего дня в массиве daysData

  // Состояния для ввода расхода в ежедневном режиме
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');

  // Загрузка данных из localStorage при первом рендере и инициализация Telegram WebApp
  useEffect(() => {
    const saved = localStorage.getItem('budgetData');
    if (saved) {
      const data = JSON.parse(saved);
      setSalary(data.salary);
      setMandatoryExpenses(data.mandatoryExpenses);
      setDaysData(data.daysData);
      setInitialized(true);
    }
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
    }
  }, []);

  // Сохранение состояния приложения при изменениях
  useEffect(() => {
    if (initialized) {
      const data = { salary, mandatoryExpenses, daysData };
      localStorage.setItem('budgetData', JSON.stringify(data));
    }
  }, [salary, mandatoryExpenses, daysData, initialized]);

  // Обработка отправки формы начальной настройки
  const handleInitSubmit = (e) => {
    e.preventDefault();
    const sal = parseFloat(salary);
    const manEx = parseFloat(mandatoryExpenses);
    if (isNaN(sal) || isNaN(manEx)) {
      alert("Введите корректные числовые значения.");
      return;
    }
    // Определяем количество дней в месяце (с учётом даты начала, если указана)
    let today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    let startDay = 1;
    if (startDate) {
      const dateObj = new Date(startDate);
      startDay = dateObj.getDate();
    }
    const totalDays = lastDayOfMonth - startDay + 1;
    // Расчет: чистый доход, сбережения (15% от зарплаты), сумма на жизнь и базовый дневной лимит
    const cleanIncome = sal - manEx;
    const savings = sal * 0.15;
    const availableForLife = cleanIncome - savings;
    const baseDaily = availableForLife / totalDays;

    // Инициализация массива дней с базовыми значениями
    const days = [];
    for (let day = startDay; day <= lastDayOfMonth; day++) {
      days.push({
        day,                   // номер дня (например, 12)
        expenses: [],          // список расходов за день
        baseDaily,             // базовый дневной лимит
        available: baseDaily,  // доступная сумма (с учетом переноса)
        calculated: 0          // остаток за день после расходов
      });
    }
    // Пересчет с учетом переносов между днями
    const updatedDays = recalcDays(days);
    setDaysData(updatedDays);
    setInitialized(true);
    setActiveView("daily");

    // Определение индекса текущего дня по системной дате.
    const currentDay = today.getDate();
    let index = updatedDays.findIndex(d => d.day === currentDay);
    if (index === -1) index = updatedDays.length - 1;
    setCurrentDayIndex(index);
  };

  // Функция пересчета баланса по дням
  const recalcDays = (days) => {
    let carry = 0;
    return days.map(dayItem => {
      const availableToday = dayItem.baseDaily + carry;
      const spentToday = dayItem.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const remainder = availableToday - spentToday;
      carry = remainder; // остаток переходит на следующий день
      return { ...dayItem, available: availableToday, calculated: remainder };
    });
  };

  // Функция добавления нового расхода для текущего дня
  const addExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Введите корректную сумму траты.");
      return;
    }
    const newExpense = { id: Date.now(), amount, desc: expenseDesc };
    const updatedDays = daysData.map((day, idx) => {
      if (idx === currentDayIndex) {
        return { ...day, expenses: [...day.expenses, newExpense] };
      }
      return day;
    });
    const recalculated = recalcDays(updatedDays);
    setDaysData(recalculated);
    setExpenseAmount('');
    setExpenseDesc('');
  };

  // Функция удаления расхода (для как ежедневного режима, так и для таблицы месяца)
  const removeExpense = (dayIndex, expenseId) => {
    const updatedDays = daysData.map((day, idx) => {
      if (idx === dayIndex) {
        return { ...day, expenses: day.expenses.filter(exp => exp.id !== expenseId) };
      }
      return day;
    });
    const recalculated = recalcDays(updatedDays);
    setDaysData(recalculated);
  };

  // Если не выполнена начальная настройка – выводим форму настройки
  if (!initialized) {
    return (
      <div className="container">
        <h2>Настройка бюджета</h2>
        <form onSubmit={handleInitSubmit}>
          <div>
            <label>Месячная зарплата: </label>
            <input
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Обязательные траты: </label>
            <input
              type="number"
              value={mandatoryExpenses}
              onChange={(e) => setMandatoryExpenses(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Дата начала (необязательно): </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <button type="submit">Рассчитать бюджет</button>
        </form>
      </div>
    );
  }

  // Режим "Ежедневный учет"
  if (activeView === "daily") {
    const todayData = daysData[currentDayIndex];
    return (
      <div className="container">
        <header>
          <button onClick={() => setActiveView("monthly")}>Таблица месяца</button>
        </header>
        <h2>День {todayData.day}</h2>
        <p>Базовый дневной лимит: {todayData.baseDaily.toFixed(2)} ₽</p>
        <p>Доступно сегодня (с учетом переноса): {todayData.available.toFixed(2)} ₽</p>
        <p>Остаток по дню: {todayData.calculated.toFixed(2)} ₽</p>

        <h3>Расходы:</h3>
        {todayData.expenses.length === 0 ? (
          <p>Расходы отсутствуют</p>
        ) : (
          <ul>
            {todayData.expenses.map(exp => (
              <li key={exp.id}>
                {exp.desc} — {exp.amount.toFixed(2)} ₽{" "}
                <button onClick={() => removeExpense(currentDayIndex, exp.id)}>Удалить</button>
              </li>
            ))}
          </ul>
        )}

        <div className="expense-input">
          <h4>Добавить расход</h4>
          <input
            type="number"
            placeholder="Сумма"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
          />
          <input
            type="text"
            placeholder="Описание"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
          />
          <button onClick={addExpense}>Добавить</button>
        </div>

        <div className="navigation">
          <button
            disabled={currentDayIndex <= 0}
            onClick={() => setCurrentDayIndex(currentDayIndex - 1)}
          >
            Предыдущий день
          </button>
          <button
            disabled={currentDayIndex >= daysData.length - 1}
            onClick={() => setCurrentDayIndex(currentDayIndex + 1)}
          >
            Следующий день
          </button>
        </div>
      </div>
    );
  }

  // Режим "Таблица месяца"
  if (activeView === "monthly") {
    return (
      <div className="container">
        <header>
          <button onClick={() => setActiveView("daily")}>Ежедневный режим</button>
        </header>
        <h2>Таблица месяца</h2>
        <table>
          <thead>
            <tr>
              <th>День</th>
              <th>Базовый лимит (₽)</th>
              <th>Доступно (₽)</th>
              <th>Остаток (₽)</th>
              <th>Расходы</th>
            </tr>
          </thead>
          <tbody>
            {daysData.map((day, idx) => (
              <tr key={day.day}>
                <td>{day.day}</td>
                <td>{day.baseDaily.toFixed(2)}</td>
                <td>{day.available.toFixed(2)}</td>
                <td>{day.calculated.toFixed(2)}</td>
                <td>
                  {day.expenses.length === 0 ? (
                    <span>Нет</span>
                  ) : (
                    <ul>
                      {day.expenses.map(exp => (
                        <li key={exp.id}>
                          {exp.desc} — {exp.amount.toFixed(2)} ₽{" "}
                          <button onClick={() => removeExpense(idx, exp.id)}>Удалить</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div>Непредвиденная ситуация.</div>;
}

ReactDOM.render(<App />, document.getElementById('root'));