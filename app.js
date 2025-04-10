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
              onKeyPress={(e) => handleKeyPress(e)}
            />
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
              onKeyPress={(e) => handleKeyPress(e)}
              placeholder="дд.мм.гггг"
              pattern="\d{2}.\d{2}.\d{4}"
            />
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
ReactDOM.render(<App />, document.getElementById('root'));