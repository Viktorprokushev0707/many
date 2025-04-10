// app.js

// Основной компонент приложения
function App() {
  // Состояния приложения
  const [initialized, setInitialized] = React.useState(false);
  const [salary, setSalary] = React.useState('');
  const [mandatoryExpenses, setMandatoryExpenses] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [daysData, setDaysData] = React.useState([]);
  const [activeView, setActiveView] = React.useState("daily");
  const [currentDayIndex, setCurrentDayIndex] = React.useState(0);

  // Состояния для ввода расхода
  const [expenseAmount, setExpenseAmount] = React.useState('');
  const [expenseDesc, setExpenseDesc] = React.useState('');
  const [expenseError, setExpenseError] = React.useState(false); // Добавлено для отслеживания ошибок ввода

  // Функция для скрытия клавиатуры на iOS
  const hideKeyboard = () => {
    // Убираем фокус с активного элемента
    document.activeElement.blur();
  };

  // Инициализация Telegram WebApp и загрузка данных из localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('budgetData');
    if (saved) {
      const data = JSON.parse(saved);
      setSalary(data.salary);
      setMandatoryExpenses(data.mandatoryExpenses);
      setDaysData(data.daysData);
      setInitialized(true);
    }
    
    // Инициализация Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      // Настройка основной кнопки Telegram
      window.Telegram.WebApp.MainButton.setText('Готово');
      window.Telegram.WebApp.MainButton.onClick(() => {
        window.Telegram.WebApp.close();
      });
    }
  }, []);

  // Сохранение данных в localStorage при изменении
  React.useEffect(() => {
    if (initialized) {
      const data = { salary, mandatoryExpenses, daysData };
      localStorage.setItem('budgetData', JSON.stringify(data));
    }
  }, [salary, mandatoryExpenses, daysData, initialized]);

  // Обработка отправки формы начальной настройки
  const handleInitSubmit = (e) => {
    e.preventDefault();
    hideKeyboard(); // Скрываем клавиатуру при отправке формы
    
    const sal = parseFloat(salary);
    const manEx = parseFloat(mandatoryExpenses);
    
    // Валидация ввода
    if (isNaN(sal) || isNaN(manEx) || sal <= 0) {
      alert("Введите корректные числовые значения.");
      return;
    }
    
    // Определение количества дней в месяце
    let today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    let startDay = 1;
    
    // Если указана дата начала, используем её
    if (startDate) {
      const dateObj = new Date(startDate);
      startDay = dateObj.getDate();
    }
    
    const totalDays = lastDayOfMonth - startDay + 1;
    
    // Расчет бюджета
    const cleanIncome = sal - manEx;
    const savings = sal * 0.15; // 15% на сбережения
    const availableForLife = cleanIncome - savings;
    const baseDaily = availableForLife / totalDays;

    // Инициализация массива дней
    const days = [];
    for (let day = startDay; day <= lastDayOfMonth; day++) {
      days.push({
        day,                   // номер дня
        expenses: [],          // список расходов
        baseDaily,             // базовый дневной лимит
        available: baseDaily,  // доступная сумма с учетом переноса
        calculated: 0          // остаток после расходов
      });
    }
    
    // Пересчет с учетом переносов
    const updatedDays = recalcDays(days);
    setDaysData(updatedDays);
    setInitialized(true);
    setActiveView("daily");

    // Определение текущего дня
    const currentDay = today.getDate();
    let index = updatedDays.findIndex(d => d.day === currentDay);
    if (index === -1) index = 0;
    setCurrentDayIndex(index);
    
    // Показываем кнопку Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.MainButton.show();
    }
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

  // Добавление нового расхода
  const addExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      // Вместо уведомления устанавливаем флаг ошибки
      setExpenseError(true);
      return;
    }
    
    // Сбрасываем флаг ошибки, если сумма корректна
    setExpenseError(false);
    
    const newExpense = { id: Date.now(), amount, desc: expenseDesc || 'Расход' };
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
    
    // Скрываем клавиатуру после добавления расхода
    hideKeyboard();
  };

  // Удаление расхода
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

  // Сброс данных и начало заново
  const resetBudget = () => {
    if (window.confirm('Вы уверены, что хотите сбросить все данные и начать заново?')) {
      localStorage.removeItem('budgetData');
      setSalary('');
      setMandatoryExpenses('');
      setStartDate('');
      setDaysData([]);
      setInitialized(false);
      
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.MainButton.hide();
      }
    }
  };

  // Расчет прогресса расходов для прогресс-бара
  const calculateProgress = (available, spent) => {
    if (available <= 0) return 100;
    const progress = (spent / available) * 100;
    return Math.min(progress, 100);
  };

  // Определение класса для прогресс-бара в зависимости от прогресса
  const getProgressClass = (progress) => {
    if (progress >= 100) return 'danger';
    if (progress >= 80) return 'warning';
    return '';
  };

  // Функция обработки нажатия Enter в полях ввода
  const handleKeyPress = (e, callback) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideKeyboard();
      if (callback) callback();
    }
  };

  // Если не выполнена начальная настройка - показываем форму настройки
  if (!initialized) {
    return (
      <div className="container">
        <h2>Настройка бюджета</h2>
        <form onSubmit={handleInitSubmit}>
          <div>
            <label>Месячный доход:</label>
            <input
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="Введите сумму"
              required
              onKeyPress={(e) => handleKeyPress(e)}
            />
          </div>
          <div>
            <label>Обязательные расходы:</label>
            <input
              type="number"
              value={mandatoryExpenses}
              onChange={(e) => setMandatoryExpenses(e.target.value)}
              placeholder="Аренда, коммунальные услуги и т.д."
              required
              onKeyPress={(e) => handleKeyPress(e)}
            />
          </div>
          <div>
            <label>Дата начала (необязательно):</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e)}              placeholder="дд.мм.гггг"
              pattern="\d{2}.\d{2}.\d{4}"            />
          </div>
          <button type="submit">Рассчитать бюджет</button>
        </form>
      </div>
    );
  }

  // Режим ежедневного учета
  if (activeView === "daily") {
    const todayData = daysData[currentDayIndex];
    const spentToday = todayData.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const progress = calculateProgress(todayData.available, spentToday);
    const progressClass = getProgressClass(progress);

    return (
      <div className="container">
        <div className="header-buttons">
          <button onClick={() => setActiveView("monthly")}>Таблица месяца</button>
          <button onClick={resetBudget}>Сбросить</button>
        </div>
        
        <h2>День {todayData.day}</h2>
        
        <div className="summary-box">
          <p>Базовый дневной лимит: {todayData.baseDaily.toFixed(2)} ₽</p>
          <p>Доступно сегодня (с учетом переноса): {todayData.available.toFixed(2)} ₽</p>
          <p>Потрачено сегодня: {spentToday.toFixed(2)} ₽</p>
          <p className={todayData.calculated < 0 ? "negative-balance" : ""}>
            Остаток: {todayData.calculated.toFixed(2)} ₽
            {todayData.calculated < 0 && " (Превышение лимита!)"}
          </p>
          
          <div className="progress-bar">
            <div 
              className={`progress-fill ${progressClass}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <h3>Расходы:</h3>
        <div className="expense-list">
          {todayData.expenses.length === 0 ? (
            <p>Расходы отсутствуют</p>
          ) : (
            todayData.expenses.map(exp => (
              <div className="expense-item" key={exp.id}>
                <div>
                  <strong>{exp.desc}</strong> — {exp.amount.toFixed(2)} ₽
                </div>
                <button onClick={() => removeExpense(currentDayIndex, exp.id)}>Удалить</button>
              </div>
            ))
          )}
        </div>

        <div className="expense-input">
          <h4>Добавить расход</h4>
          <input
            type="number"
            placeholder="Сумма"
            value={expenseAmount}
            onChange={(e) => {
              setExpenseAmount(e.target.value);
              // Сбрасываем флаг ошибки при изменении значения
              setExpenseError(false);
            }}
            onKeyPress={(e) => handleKeyPress(e)}
            className={expenseError ? "input-error" : ""}
          />
          {expenseError && <small className="error-message">Введите корректную сумму</small>}
          <input
            type="text"
            placeholder="Описание (например, обед, кофе)"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, expenseAmount ? addExpense : null)}
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

  // Режим таблицы месяца
  if (activeView === "monthly") {
    return (
      <div className="container">
        <div className="header-buttons">
          <button onClick={() => setActiveView("daily")}>Ежедневный режим</button>
          <button onClick={resetBudget}>Сбросить</button>
        </div>
        
        <h2>Таблица месяца</h2>
        
        <div className="month-table-container">
          <table>
            <thead>
              <tr>
                <th>День</th>
                <th>Лимит (₽)</th>
                <th>Доступно (₽)</th>
                <th>Расходы (₽)</th>
                <th>Остаток (₽)</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {daysData.map((day, idx) => {
                const spentToday = day.expenses.reduce((sum, exp) => sum + exp.amount, 0);
                return (
                  <tr key={day.day} className={day.calculated < 0 ? "negative-balance" : ""}>
                    <td>{day.day}</td>
                    <td>{day.baseDaily.toFixed(2)}</td>
                    <td>{day.available.toFixed(2)}</td>
                    <td>{spentToday.toFixed(2)}</td>
                    <td>{day.calculated.toFixed(2)}</td>
                    <td>
                      <button onClick={() => {
                        setCurrentDayIndex(idx);
                        setActiveView("daily");
                      }}>
                        Подробнее
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <div>Непредвиденная ситуация.</div>;
}

// Рендерим приложение
ReactDOM.render(<App />, document.getElementById('root'));// app.js

// u041eu0441u043du043eu0432u043du043eu0439 u043au043eu043cu043fu043eu043du0435u043du0442 u043fu0440u0438u043bu043eu0436u0435u043du0438u044f
function App() {
  // u0421u043eu0441u0442u043eu044fu043du0438u044f u043fu0440u0438u043bu043eu0436u0435u043du0438u044f
  const [initialized, setInitialized] = React.useState(false);
  const [salary, setSalary] = React.useState('');
  const [mandatoryExpenses, setMandatoryExpenses] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [daysData, setDaysData] = React.useState([]);
  const [activeView, setActiveView] = React.useState("daily");
  const [currentDayIndex, setCurrentDayIndex] = React.useState(0);

  // u0421u043eu0441u0442u043eu044fu043du0438u044f u0434u043bu044f u0432u0432u043eu0434u0430 u0440u0430u0441u0445u043eu0434u0430
  const [expenseAmount, setExpenseAmount] = React.useState('');
  const [expenseDesc, setExpenseDesc] = React.useState('');
  const [expenseError, setExpenseError] = React.useState(false); // u0414u043eu0431u0430u0432u043bu0435u043du043e u0434u043bu044f u043eu0442u0441u043bu0435u0436u0438u0432u0430u043du0438u044f u043eu0448u0438u0431u043eu043a u0432u0432u043eu0434u0430

  // u0424u0443u043du043au0446u0438u044f u0434u043bu044f u0441u043au0440u044bu0442u0438u044f u043au043bu0430u0432u0438u0430u0442u0443u0440u044b u043du0430 iOS
  const hideKeyboard = () => {
    // u0423u0431u0438u0440u0430u0435u043c u0444u043eu043au0443u0441 u0441 u0430u043au0442u0438u0432u043du043eu0433u043e u044du043bu0435u043cu0435u043du0442u0430
    document.activeElement.blur();
  };

  // u0418u043du0438u0446u0438u0430u043bu0438u0437u0430u0446u0438u044f Telegram WebApp u0438 u0437u0430u0433u0440u0443u0437u043au0430 u0434u0430u043du043du044bu0445 u0438u0437 localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('budgetData');
    if (saved) {
      const data = JSON.parse(saved);
      setSalary(data.salary);
      setMandatoryExpenses(data.mandatoryExpenses);
      setDaysData(data.daysData);
      setInitialized(true);
    }
    
    // u0418u043du0438u0446u0438u0430u043bu0438u0437u0430u0446u0438u044f Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      // u041du0430u0441u0442u0440u043eu0439u043au0430 u043eu0441u043du043eu0432u043du043eu0439 u043au043du043eu043fu043au0438 Telegram
      window.Telegram.WebApp.MainButton.setText('u0413u043eu0442u043eu0432u043e');
      window.Telegram.WebApp.MainButton.onClick(() => {
        window.Telegram.WebApp.close();
      });
    }
  }, []);

  // u0421u043eu0445u0440u0430u043du0435u043du0438u0435 u0434u0430u043du043du044bu0445 u0432 localStorage u043fu0440u0438 u0438u0437u043cu0435u043du0435u043du0438u0438
  React.useEffect(() => {
    if (initialized) {
      const data = { salary, mandatoryExpenses, daysData };
      localStorage.setItem('budgetData', JSON.stringify(data));
    }
  }, [salary, mandatoryExpenses, daysData, initialized]);

  // u041eu0431u0440u0430u0431u043eu0442u043au0430 u043eu0442u043fu0440u0430u0432u043au0438 u0444u043eu0440u043cu044b u043du0430u0447u0430u043bu044cu043du043eu0439 u043du0430u0441u0442u0440u043eu0439u043au0438
  const handleInitSubmit = (e) => {
    e.preventDefault();
    hideKeyboard(); // u0421u043au0440u044bu0432u0430u0435u043c u043au043bu0430u0432u0438u0430u0442u0443u0440u0443 u043fu0440u0438 u043eu0442u043fu0440u0430u0432u043au0435 u0444u043eu0440u043cu044b
    
    const sal = parseFloat(salary);
    const manEx = parseFloat(mandatoryExpenses);
    
    // u0412u0430u043bu0438u0434u0430u0446u0438u044f u0432u0432u043eu0434u0430
    if (isNaN(sal) || isNaN(manEx) || sal <= 0) {
      alert("u0412u0432u0435u0434u0438u0442u0435 u043au043eu0440u0440u0435u043au0442u043du044bu0435 u0447u0438u0441u043bu043eu0432u044bu0435 u0437u043du0430u0447u0435u043du0438u044f.");
      return;
    }
    
    // u041eu043fu0440u0435u0434u0435u043bu0435u043du0438u0435 u043au043eu043bu0438u0447u0435u0441u0442u0432u0430 u0434u043du0435u0439 u0432 u043cu0435u0441u044fu0446u0435
    let today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    let startDay = 1;
    
    // u0415u0441u043bu0438 u0443u043au0430u0437u0430u043du0430 u0434u0430u0442u0430 u043du0430u0447u0430u043bu0430, u0438u0441u043fu043eu043bu044cu0437u0443u0435u043c u0435u0451
    if (startDate) {
      const dateObj = new Date(startDate);
      startDay = dateObj.getDate();
    }
    
    const totalDays = lastDayOfMonth - startDay + 1;
    
    // u0420u0430u0441u0447u0435u0442 u0431u044eu0434u0436u0435u0442u0430
    const cleanIncome = sal - manEx;
    const savings = sal * 0.15; // 15% u043du0430 u0441u0431u0435u0440u0435u0436u0435u043du0438u044f
    const availableForLife = cleanIncome - savings;
    const baseDaily = availableForLife / totalDays;

    // u0418u043du0438u0446u0438u0430u043bu0438u0437u0430u0446u0438u044f u043cu0430u0441u0441u0438u0432u0430 u0434u043du0435u0439
    const days = [];
    for (let day = startDay; day <= lastDayOfMonth; day++) {
      days.push({
        day,                   // u043du043eu043cu0435u0440 u0434u043du044f
        expenses: [],          // u0441u043fu0438u0441u043eu043a u0440u0430u0441u0445u043eu0434u043eu0432
        baseDaily,             // u0431u0430u0437u043eu0432u044bu0439 u0434u043du0435u0432u043du043eu0439 u043bu0438u043cu0438u0442
        available: baseDaily,  // u0434u043eu0441u0442u0443u043fu043du0430u044f u0441u0443u043cu043cu0430 u0441 u0443u0447u0435u0442u043eu043c u043fu0435u0440u0435u043du043eu0441u0430
        calculated: 0          // u043eu0441u0442u0430u0442u043eu043a u043fu043eu0441u043bu0435 u0440u0430u0441u0445u043eu0434u043eu0432
      });
    }
    
    // u041fu0435u0440u0435u0441u0447u0435u0442 u0441 u0443u0447u0435u0442u043eu043c u043fu0435u0440u0435u043du043eu0441u043eu0432
    const updatedDays = recalcDays(days);
    setDaysData(updatedDays);
    setInitialized(true);
    setActiveView("daily");

    // u041eu043fu0440u0435u0434u0435u043bu0435u043du0438u0435 u0442u0435u043au0443u0449u0435u0433u043e u0434u043du044f
    const currentDay = today.getDate();
    let index = updatedDays.findIndex(d => d.day === currentDay);
    if (index === -1) index = 0;
    setCurrentDayIndex(index);
    
    // u041fu043eu043au0430u0437u044bu0432u0430u0435u043c u043au043du043eu043fu043au0443 Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.MainButton.show();
    }
  };

  // u0424u0443u043du043au0446u0438u044f u043fu0435u0440u0435u0441u0447u0435u0442u0430 u0431u0430u043bu0430u043du0441u0430 u043fu043e u0434u043du044fu043c
  const recalcDays = (days) => {
    let carry = 0;
    return days.map(dayItem => {
      const availableToday = dayItem.baseDaily + carry;
      const spentToday = dayItem.expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const remainder = availableToday - spentToday;
      carry = remainder; // u043eu0441u0442u0430u0442u043eu043a u043fu0435u0440u0435u0445u043eu0434u0438u0442 u043du0430 u0441u043bu0435u0434u0443u044eu0449u0438u0439 u0434u0435u043du044c
      return { ...dayItem, available: availableToday, calculated: remainder };
    });
  };

  // u0414u043eu0431u0430u0432u043bu0435u043du0438u0435 u043du043eu0432u043eu0433u043e u0440u0430u0441u0445u043eu0434u0430
  const addExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      // u0412u043cu0435u0441u0442u043e u0443u0432u0435u0434u043eu043cu043bu0435u043du0438u044f u0443u0441u0442u0430u043du0430u0432u043bu0438u0432u0430u0435u043c u0444u043bu0430u0433 u043eu0448u0438u0431u043au0438
      setExpenseError(true);
      return;
    }
    
    // u0421u0431u0440u0430u0441u044bu0432u0430u0435u043c u0444u043bu0430u0433 u043eu0448u0438u0431u043au0438, u0435u0441u043bu0438 u0441u0443u043cu043cu0430 u043au043eu0440u0440u0435u043au0442u043du0430
    setExpenseError(false);
    
    const newExpense = { id: Date.now(), amount, desc: expenseDesc || 'u0420u0430u0441u0445u043eu0434' };
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
    
    // u0421u043au0440u044bu0432u0430u0435u043c u043au043bu0430u0432u0438u0430u0442u0443u0440u0443 u043fu043eu0441u043bu0435 u0434u043eu0431u0430u0432u043bu0435u043du0438u044f u0440u0430u0441u0445u043eu0434u0430
    hideKeyboard();
  };

  // u0423u0434u0430u043bu0435u043du0438u0435 u0440u0430u0441u0445u043eu0434u0430
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

  // u0421u0431u0440u043eu0441 u0434u0430u043du043du044bu0445 u0438 u043du0430u0447u0430u043bu043e u0437u0430u043du043eu0432u043e
  const resetBudget = () => {
    if (window.confirm('u0412u044b u0443u0432u0435u0440u0435u043du044b, u0447u0442u043e u0445u043eu0442u0438u0442u0435 u0441u0431u0440u043eu0441u0438u0442u044c u0432u0441u0435 u0434u0430u043du043du044bu0435 u0438 u043du0430u0447u0430u0442u044c u0437u0430u043du043eu0432u043e?')) {
      localStorage.removeItem('budgetData');
      setSalary('');
      setMandatoryExpenses('');
      setStartDate('');
      setDaysData([]);
      setInitialized(false);
      
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.MainButton.hide();
      }
    }
  };

  // u0420u0430u0441u0447u0435u0442 u043fu0440u043eu0433u0440u0435u0441u0441u0430 u0440u0430u0441u0445u043eu0434u043eu0432 u0434u043bu044f u043fu0440u043eu0433u0440u0435u0441u0441-u0431u0430u0440u0430
  const calculateProgress = (available, spent) => {
    if (available <= 0) return 100;
    const progress = (spent / available) * 100;
    return Math.min(progress, 100);
  };

  // u041eu043fu0440u0435u0434u0435u043bu0435u043du0438u0435 u043au043bu0430u0441u0441u0430 u0434u043bu044f u043fu0440u043eu0433u0440u0435u0441u0441-u0431u0430u0440u0430 u0432 u0437u0430u0432u0438u0441u0438u043cu043eu0441u0442u0438 u043eu0442 u043fu0440u043eu0433u0440u0435u0441u0441u0430
  const getProgressClass = (progress) => {
    if (progress >= 100) return 'danger';
    if (progress >= 80) return 'warning';
    return '';
  };

  // u0424u0443u043du043au0446u0438u044f u043eu0431u0440u0430u0431u043eu0442u043au0438 u043du0430u0436u0430u0442u0438u044f Enter u0432 u043fu043eu043bu044fu0445 u0432u0432u043eu0434u0430
  const handleKeyPress = (e, callback) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideKeyboard();
      if (callback) callback();
    }
  };

  // u0415u0441u043bu0438 u043du0435 u0432u044bu043fu043eu043bu043du0435u043du0430 u043du0430u0447u0430u043bu044cu043du0430u044f u043du0430u0441u0442u0440u043eu0439u043au0430 - u043fu043eu043au0430u0437u044bu0432u0430u0435u043c u0444u043eu0440u043cu0443 u043du0430u0441u0442u0440u043eu0439u043au0438
  if (!initialized) {
    return (
      <div className="container">
        <h2>u041du0430u0441u0442u0440u043eu0439u043au0430 u0431u044eu0434u0436u0435u0442u0430</h2>
        <form onSubmit={handleInitSubmit}>
          <div>
            <label>u041cu0435u0441u044fu0447u043du044bu0439 u0434u043eu0445u043eu0434:</label>
            <input
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="u0412u0432u0435u0434u0438u0442u0435 u0441u0443u043cu043cu0443"
              required
              onKeyPress={(e) => handleKeyPress(e)}
            />
          </div>
          <div>
            <label>u041eu0431u044fu0437u0430u0442u0435u043bu044cu043du044bu0435 u0440u0430u0441u0445u043eu0434u044b:</label>
            <input
              type="number"
              value={mandatoryExpenses}
              onChange={(e) => setMandatoryExpenses(e.target.value)}
              placeholder="u0410u0440u0435u043du0434u0430, u043au043eu043cu043cu0443u043du0430u043bu044cu043du044bu0435 u0443u0441u043bu0443u0433u0438 u0438 u0442.u0434."
              required
              onKeyPress={(e) => handleKeyPress(e)}
            />
          </div>
          <div>
            <label>u0414u0430u0442u0430 u043du0430u0447u0430u043bu0430 (u043du0435u043eu0431u044fu0437u0430u0442u0435u043bu044cu043du043e):</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e)}
            />
          </div>
          <button type="submit">u0420u0430u0441u0441u0447u0438u0442u0430u0442u044c u0431u044eu0434u0436u0435u0442</button>
        </form>
      </div>
    );
  }

  // u0420u0435u0436u0438u043c u0435u0436u0435u0434u043du0435u0432u043du043eu0433u043e u0443u0447u0435u0442u0430
  if (activeView === "daily") {
    const todayData = daysData[currentDayIndex];
    const spentToday = todayData.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const progress = calculateProgress(todayData.available, spentToday);
    const progressClass = getProgressClass(progress);

    return (
      <div className="container">
        <div className="header-buttons">
          <button onClick={() => setActiveView("monthly")}>u0422u0430u0431u043bu0438u0446u0430 u043cu0435u0441u044fu0446u0430</button>
          <button onClick={resetBudget}>u0421u0431u0440u043eu0441u0438u0442u044c</button>
        </div>
        
        <h2>u0414u0435u043du044c {todayData.day}</h2>
        
        <div className="summary-box">
          <p>u0411u0430u0437u043eu0432u044bu0439 u0434u043du0435u0432u043du043eu0439 u043bu0438u043cu0438u0442: {todayData.baseDaily.toFixed(2)} u20bd</p>
          <p>u0414u043eu0441u0442u0443u043fu043du043e u0441u0435u0433u043eu0434u043du044f (u0441 u0443u0447u0435u0442u043eu043c u043fu0435u0440u0435u043du043eu0441u0430): {todayData.available.toFixed(2)} u20bd</p>
          <p>u041fu043eu0442u0440u0430u0447u0435u043du043e u0441u0435u0433u043eu0434u043du044f: {spentToday.toFixed(2)} u20bd</p>
          <p className={todayData.calculated < 0 ? "negative-balance" : ""}>
            u041eu0441u0442u0430u0442u043eu043a: {todayData.calculated.toFixed(2)} u20bd
            {todayData.calculated < 0 && " (u041fu0440u0435u0432u044bu0448u0435u043du0438u0435 u043bu0438u043cu0438u0442u0430!)"}
          </p>
          
          <div className="progress-bar">
            <div 
              className={`progress-fill ${progressClass}`} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <h3>u0420u0430u0441u0445u043eu0434u044b:</h3>
        <div className="expense-list">
          {todayData.expenses.length === 0 ? (
            <p>u0420u0430u0441u0445u043eu0434u044b u043eu0442u0441u0443u0442u0441u0442u0432u0443u044eu0442</p>
          ) : (
            todayData.expenses.map(exp => (
              <div className="expense-item" key={exp.id}>
                <div>
                  <strong>{exp.desc}</strong> u2014 {exp.amount.toFixed(2)} u20bd
                </div>
                <button onClick={() => removeExpense(currentDayIndex, exp.id)}>u0423u0434u0430u043bu0438u0442u044c</button>
              </div>
            ))
          )}
        </div>

        <div className="expense-input">
          <h4>u0414u043eu0431u0430u0432u0438u0442u044c u0440u0430u0441u0445u043eu0434</h4>
          <input
            type="number"
            placeholder="u0421u0443u043cu043cu0430"
            value={expenseAmount}
            onChange={(e) => {
              setExpenseAmount(e.target.value);
              // u0421u0431u0440u0430u0441u044bu0432u0430u0435u043c u0444u043bu0430u0433 u043eu0448u0438u0431u043au0438 u043fu0440u0438 u0438u0437u043cu0435u043du0435u043du0438u0438 u0437u043du0430u0447u0435u043du0438u044f
              setExpenseError(false);
            }}
            onKeyPress={(e) => handleKeyPress(e)}
            className={expenseError ? "input-error" : ""}
          />
          {expenseError && <small className="error-message">u0412u0432u0435u0434u0438u0442u0435 u043au043eu0440u0440u0435u043au0442u043du0443u044e u0441u0443u043cu043cu0443</small>}
          <input
            type="text"
            placeholder="u041eu043fu0438u0441u0430u043du0438u0435 (u043du0430u043fu0440u0438u043cu0435u0440, u043eu0431u0435u0434, u043au043eu0444u0435)"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, expenseAmount ? addExpense : null)}
          />
          <button onClick={addExpense}>u0414u043eu0431u0430u0432u0438u0442u044c</button>
        </div>

        <div className="navigation">
          <button
            disabled={currentDayIndex <= 0}
            onClick={() => setCurrentDayIndex(currentDayIndex - 1)}
          >
            u041fu0440u0435u0434u044bu0434u0443u0449u0438u0439 u0434u0435u043du044c
          </button>
          <button
            disabled={currentDayIndex >= daysData.length - 1}
            onClick={() => setCurrentDayIndex(currentDayIndex + 1)}
          >
            u0421u043bu0435u0434u0443u044eu0449u0438u0439 u0434u0435u043du044c
          </button>
        </div>
      </div>
    );
  }

  // u0420u0435u0436u0438u043c u0442u0430u0431u043bu0438u0446u044b u043cu0435u0441u044fu0446u0430
  if (activeView === "monthly") {
    return (
      <div className="container">
        <div className="header-buttons">
          <button onClick={() => setActiveView("daily")}>u0415u0436u0435u0434u043du0435u0432u043du044bu0439 u0440u0435u0436u0438u043c</button>
          <button onClick={resetBudget}>u0421u0431u0440u043eu0441u0438u0442u044c</button>
        </div>
        
        <h2>u0422u0430u0431u043bu0438u0446u0430 u043cu0435u0441u044fu0446u0430</h2>
        
        <div className="month-table-container">
          <table>
            <thead>
              <tr>
                <th>u0414u0435u043du044c</th>
                <th>u041bu0438u043cu0438u0442 (u20bd)</th>
                <th>u0414u043eu0441u0442u0443u043fu043du043e (u20bd)</th>
                <th>u0420u0430u0441u0445u043eu0434u044b (u20bd)</th>
                <th>u041eu0441u0442u0430u0442u043eu043a (u20bd)</th>
                <th>u0414u0435u0439u0441u0442u0432u0438u044f</th>
              </tr>
            </thead>
            <tbody>
              {daysData.map((day, idx) => {
                const spentToday = day.expenses.reduce((sum, exp) => sum + exp.amount, 0);
                return (
                  <tr key={day.day} className={day.calculated < 0 ? "negative-balance" : ""}>
                    <td>{day.day}</td>
                    <td>{day.baseDaily.toFixed(2)}</td>
                    <td>{day.available.toFixed(2)}</td>
                    <td>{spentToday.toFixed(2)}</td>
                    <td>{day.calculated.toFixed(2)}</td>
                    <td>
                      <button onClick={() => {
                        setCurrentDayIndex(idx);
                        setActiveView("daily");
                      }}>
                        u041fu043eu0434u0440u043eu0431u043du0435u0435
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <div>u041du0435u043fu0440u0435u0434u0432u0438u0434u0435u043du043du0430u044f u0441u0438u0442u0443u0430u0446u0438u044f.</div>;
}

// u0420u0435u043du0434u0435u0440u0438u043c u043fu0440u0438u043bu043eu0436u0435u043du0438u0435
ReactDOM.render(<App />, document.getElementById('root'));