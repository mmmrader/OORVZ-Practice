import axios from 'axios';

const API_KEY = '4c611589'; // <--- Вставте ключ
const BASE_URL = 'https://www.omdbapi.com/';

// Елементи DOM
const input = document.getElementById('searchInput');
const container = document.getElementById('moviesContainer');
const typeFilter = document.getElementById('typeFilter');
const yearSort = document.getElementById('yearSort');
const ratingFilter = document.getElementById('ratingFilter'); // Нове
const savedCountBadge = document.getElementById('savedCount');
const sectionTitle = document.getElementById('sectionTitle');
const loader = document.getElementById('loader');

// Стан додатка
let currentPage = 1;
let currentQuery = '';
let englishQuery = ''; // Збереження перекладеного запиту
let currentType = '';
let currentSort = 'default';
let minRating = 0; // Мінімальний рейтинг
let isLoading = false; // Щоб не грузити 100 разів при скролі
let totalResults = 0;

let favoriteMovies = JSON.parse(localStorage.getItem('favoriteMovies')) || [];
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

const popularKeywords = ['Marvel', 'Harry Potter', 'Star Wars', 'Lord of the Rings', 'Batman', 'Avengers', 'Spider-Man'];
const popularSeries = ['Breaking Bad', 'Game of Thrones', 'Stranger Things', 'The Witcher', 'The Mandalorian'];

// --- ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener('DOMContentLoaded', () => {
    updateSavedCount();
    renderHistory();
    renderSeriesTags();
    
    // НЕСКІНЧЕННИЙ СКРОЛ
    window.addEventListener('scroll', handleInfiniteScroll);
});
// --- ПЕРЕКЛАД ---
async function translateToEnglish(text) {
    // Перевірка: якщо немає кирилиці (укр/рос літер), то не перекладаємо
    // Це економить час і трафік
    if (!/[а-яА-ЯёЁіІїЇєЄґҐ]/.test(text)) {
        return text;
    }

    try {
        // Використовуємо надійний Google Translate API (client=gtx)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        
        const response = await axios.get(url);
        
        // Google повертає масив масивів, беремо потрібний текст
        // Зазвичай це response.data[0][0][0]
        if (response.data && response.data[0] && response.data[0][0]) {
            const translatedText = response.data[0][0][0];
            console.log(`Перекладено: ${text} -> ${translatedText}`);
            return translatedText;
        }
    } catch (e) {
        console.error("Помилка перекладу:", e);
    }

    // Якщо переклад не вдався, повертаємо текст як є, щоб хоч щось шукало
    return text;
}

// --- ОБРОБНИКИ ПОДІЙ ---

document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (query.length < 2) {
        showError('Введіть назву фільму');
        return;
    }
    addToHistory(query);
    
    // Скидання стану
    currentPage = 1;
    currentQuery = query;
    container.innerHTML = ''; 
    updateSectionTitle(`Шукаємо: "${query}"...`);
    
    // 1. Перекладаємо запит
    showLoader(true);
    englishQuery = await translateToEnglish(query);
    
    // 2. Шукаємо
    fetchMovies();
    setActiveNav('navHome');
});

// Фільтри
typeFilter.addEventListener('change', () => {
    currentType = typeFilter.value;
    resetAndSearch();
});

yearSort.addEventListener('change', () => {
    currentSort = yearSort.value;
    resetAndSearch();
});

ratingFilter.addEventListener('change', () => {
    minRating = parseFloat(ratingFilter.value);
    // Тут не треба перезавантажувати API, просто ховаємо/показуємо картки
    filterVisibleCardsByRating();
});

function resetAndSearch() {
    if (!englishQuery) return;
    currentPage = 1;
    container.innerHTML = '';
    fetchMovies();
}

// --- НЕСКІНЧЕННИЙ СКРОЛ ---
function handleInfiniteScroll() {
    // (Висота всього документа - Висота вікна - Прокрутка) < 100px
    const endOfPage = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500;
    
    if (endOfPage && !isLoading && (currentPage * 10 < totalResults)) {
        currentPage++;
        fetchMovies();
    }
}

// --- ОСНОВНА ЛОГІКА (API) ---

async function fetchMovies() {
    if (isLoading) return; // Захист від подвійного запиту
    isLoading = true;
    showLoader(true);
    showError(null);

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                apikey: API_KEY,
                s: englishQuery, // Шукаємо англійською
                page: currentPage,
                type: currentType
            }
        });

        const data = response.data;

        if (data.Response === 'True') {
            totalResults = parseInt(data.totalResults);
            let movies = data.Search;

            // Клієнтське сортування за роком
            if (currentSort === 'newest') {
                movies.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
            } else if (currentSort === 'oldest') {
                movies.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
            }

            renderMovies(movies);
            
            // Оновлюємо заголовок, якщо це перший запит
            if (currentPage === 1) {
                updateSectionTitle(`Результати для "${currentQuery}" (${englishQuery})`);
            }
        } else {
            if (currentPage === 1) showError('Нічого не знайдено 😔');
        }
    } catch (error) {
        showError('Помилка: ' + error.message);
    } finally {
        showLoader(false);
        isLoading = false;
    }
}

// Завантаження рейтингу
async function fetchRatingForMovie(imdbID, elementId, cardId) {
    try {
        const response = await axios.get(BASE_URL, {
            params: { apikey: API_KEY, i: imdbID }
        });
        const rating = parseFloat(response.data.imdbRating);
        const element = document.getElementById(elementId);
        const card = document.getElementById(cardId);
        
        if (element && !isNaN(rating)) {
            element.innerHTML = `<i class="bi bi-star-fill"></i> ${rating}`;
            // Зберігаємо рейтинг в атрибут картки для фільтрації
            card.setAttribute('data-rating', rating);
            
            // Якщо рейтинг менший за обраний фільтр - ховаємо картку
            if (rating < minRating) {
                card.closest('.col').classList.add('d-none');
            }
        } else if (element) {
            element.innerHTML = `<i class="bi bi-star"></i> -`;
            card.setAttribute('data-rating', 0);
            if (minRating > 0) card.closest('.col').classList.add('d-none');
        }
    } catch (e) { console.error(e); }
}

function filterVisibleCardsByRating() {
    const cards = document.querySelectorAll('.movie-card');
    cards.forEach(card => {
        const rating = parseFloat(card.getAttribute('data-rating')) || 0;
        const col = card.closest('.col');
        
        if (rating >= minRating) {
            col.classList.remove('d-none');
        } else {
            col.classList.add('d-none');
        }
    });
}

// --- РЕНДЕРИНГ ---

function renderMovies(movies) {
    if (!movies) return;

    const moviesHTML = movies.map(movie => {
        const isFav = favoriteMovies.some(fav => fav.imdbID === movie.imdbID);
        const heartClass = isFav ? 'active' : '';
        const heartIcon = isFav ? 'bi-heart-fill' : 'bi-heart';
        const ratingElementId = `rating-${movie.imdbID}`;
        const cardId = `card-${movie.imdbID}`;

        const movieData = encodeURIComponent(JSON.stringify({
            Title: movie.Title, Year: movie.Year, imdbID: movie.imdbID, Poster: movie.Poster
        }));

        // Запускаємо пошук рейтингу
        fetchRatingForMovie(movie.imdbID, ratingElementId, cardId);

        return `
        <div class="col fade-in">
            <div id="${cardId}" class="card h-100 movie-card shadow-sm position-relative" data-rating="0">
                
                <div class="rating-badge" id="${ratingElementId}">
                    <div class="spinner-border spinner-border-sm text-warning" role="status"></div>
                </div>

                <button class="favorite-btn ${heartClass}" 
                        onclick="event.stopPropagation(); toggleFavorite('${movie.imdbID}', this)"
                        data-movie="${movieData}">
                    <i class="bi ${heartIcon}"></i>
                </button>

                <div class="poster-wrapper">
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://placehold.co/300x450?text=No+Poster'}" 
                         alt="${movie.Title}" loading="lazy" referrerpolicy="no-referrer"
                         onerror="this.onerror=null; this.src='https://placehold.co/300x450?text=No+Poster';">
                </div>
                
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-truncate" title="${movie.Title}">${movie.Title}</h5>
                    <div class="mt-auto d-flex justify-content-between align-items-center">
                        <span class="movie-year-badge">${movie.Year}</span>
                        <a href="https://www.imdb.com/title/${movie.imdbID}" target="_blank" class="btn btn-outline-light btn-sm stretched-link">IMDb</a>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
    
    container.insertAdjacentHTML('beforeend', moviesHTML);
}

// --- ДОПОМІЖНІ ФУНКЦІЇ (Копія старих) ---
// (Історія, Збережене, Навігація - все залишається як було в минулому коді)
// Я додам сюди скорочені версії для цілісності

function showFavorites() {
    container.innerHTML = '';
    window.removeEventListener('scroll', handleInfiniteScroll); // Вимикаємо скрол у збережених
    sectionTitle.classList.remove('d-none');
    sectionTitle.innerText = 'Ваша колекція';
    if (favoriteMovies.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-white"><p>Поки що пусто.</p></div>';
        return;
    }
    renderMovies(favoriteMovies);
}

document.getElementById('navHome').addEventListener('click', (e) => {
    e.preventDefault();
    container.innerHTML = ''; input.value = '';
    window.addEventListener('scroll', handleInfiniteScroll); // Вмикаємо назад
    updateSectionTitle(''); setActiveNav('navHome');
});

// Додайте решту функцій: toggleFavorite, addToHistory, renderHistory, etc.
// Вони ідентичні попередньому варіанту.

// Нижче функції-хелпери, які обов'язково мають бути:
function showLoader(isLoading) {
    isLoading ? loader.classList.remove('d-none') : loader.classList.add('d-none');
}
function showError(msg) {
    const errorAlert = document.getElementById('errorAlert');
    if (msg) { errorAlert.textContent = msg; errorAlert.classList.remove('d-none'); } 
    else { errorAlert.classList.add('d-none'); }
}
function updateSavedCount() { savedCountBadge.innerText = favoriteMovies.length; }
function setActiveNav(id) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function updateSectionTitle(text) {
    sectionTitle.classList.remove('d-none');
    sectionTitle.innerText = text;
}
function renderHistory() {
    const historyContainer = document.getElementById('historyContainer');
    if (searchHistory.length === 0) { historyContainer.innerHTML = ''; return; }
    historyContainer.innerHTML = searchHistory.map(q => 
        `<span class="badge badge-tag history-item" onclick="searchFromTag('${q}')">🕒 ${q}</span>`
    ).join('');
}
function renderSeriesTags() {
    document.getElementById('seriesTags').innerHTML = popularSeries.map(s => 
        `<span class="badge badge-tag" onclick="searchFromTag('${s}')">📺 ${s}</span>`
    ).join('');
}
function addToHistory(query) {
    searchHistory = searchHistory.filter(item => item.toLowerCase() !== query.toLowerCase());
    searchHistory.unshift(query);
    if (searchHistory.length > 5) searchHistory.pop();
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderHistory();
}
window.searchFromTag = function(query) {
    input.value = query;
    englishQuery = query; // Припускаємо, що теги вже англійською (або перекладуться при сабміті)
    if (/[а-яА-Я]/.test(query)) { // Якщо тег кириличний - викликаємо через сабміт форми
        input.value = query;
        document.getElementById('searchForm').dispatchEvent(new Event('submit'));
        return;
    }
    // Якщо англ - напряму
    currentPage = 1; container.innerHTML = ''; currentQuery = query;
    fetchMovies();
    updateSectionTitle(`Результати: "${query}"`);
    setActiveNav('navHome');
};
window.toggleFavorite = function(id, btnElement) {
    const movieData = JSON.parse(decodeURIComponent(btnElement.getAttribute('data-movie')));
    const index = favoriteMovies.findIndex(m => m.imdbID === id);
    const icon = btnElement.querySelector('i');
    if (index === -1) {
        favoriteMovies.push(movieData); btnElement.classList.add('active'); icon.classList.replace('bi-heart', 'bi-heart-fill');
    } else {
        favoriteMovies.splice(index, 1); btnElement.classList.remove('active'); icon.classList.replace('bi-heart-fill', 'bi-heart');
        if (document.getElementById('navSaved').classList.contains('active')) { container.innerHTML = ''; renderMovies(favoriteMovies); }
    }
    localStorage.setItem('favoriteMovies', JSON.stringify(favoriteMovies));
    updateSavedCount();
};

document.getElementById('navPopular').addEventListener('click', (e) => {
    e.preventDefault();
    const randomQuery = popularKeywords[Math.floor(Math.random() * popularKeywords.length)];
    englishQuery = randomQuery;
    currentQuery = randomQuery;
    currentPage = 1; container.innerHTML = '';
    fetchMovies();
    updateSectionTitle(`Популярне: "${randomQuery}"`);
    setActiveNav('navPopular');
});
const backToTopBtn = document.getElementById('backToTopBtn');

// Слухаємо скрол
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) { // Якщо прокрутили більше 300px
        backToTopBtn.classList.add('show');
    } else {
        backToTopBtn.classList.remove('show');
    }
});

// Клік по кнопці
backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Плавна прокрутка
    });
});