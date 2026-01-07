import axios from 'axios';

// --- НАЛАШТУВАННЯ ---
const API_KEY = '4c611589'; // Ваш ключ
const BASE_URL = 'https://www.omdbapi.com/';

// Елементи DOM
const input = document.getElementById('searchInput');
const container = document.getElementById('moviesContainer');
const typeFilter = document.getElementById('typeFilter');
const yearSort = document.getElementById('yearSort');
const ratingFilter = document.getElementById('ratingFilter');
const savedCountBadge = document.getElementById('savedCount');
const sectionTitle = document.getElementById('sectionTitle');
const loader = document.getElementById('loader');
const backToTopBtn = document.getElementById('backToTopBtn');

// Стан додатка
let currentPage = 1;
let currentQuery = '';
let englishQuery = '';
let currentType = '';
let currentSort = 'default';
let minRating = 0;
let isLoading = false;
let totalResults = 0;
let isViewingFavorites = false; // Прапорець для вкладки "Збережене"

// Завантаження даних з LocalStorage
let favoriteMovies = JSON.parse(localStorage.getItem('favoriteMovies')) || [];
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

const popularKeywords = ['Marvel', 'Harry Potter', 'Star Wars', 'Lord of the Rings', 'Batman', 'Avengers', 'Spider-Man'];
const popularSeries = ['Breaking Bad', 'Game of Thrones', 'Stranger Things', 'The Witcher', 'The Mandalorian'];

// --- ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener('DOMContentLoaded', () => {
    updateSavedCount();
    renderHistory();
    renderSeriesTags();
    
    // Вмикаємо нескінченний скрол
    window.addEventListener('scroll', handleInfiniteScroll);
});
// --- ПЕРЕКЛАД (Google API) ---
async function translateToEnglish(text) {
    const hasCyrillic = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(text);
    if (!hasCyrillic) return text;

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url);
        if (response.data && response.data[0] && response.data[0][0]) {
            return response.data[0][0][0];
        }
    } catch (e) {
        console.error("Google переклад не вдався, пробуємо резерв...");
        try {
            const fallback = await axios.get('https://api.mymemory.translated.net/get', {
                params: { q: text, langpair: 'Autodetect|en' }
            });
            if (fallback.data.responseData.translatedText) {
                return fallback.data.responseData.translatedText;
            }
        } catch (err) { console.error("Переклад не вдався"); }
    }
    return text;
}

// --- ОБРОБНИКИ ПОДІЙ ---

// 1. Пошук
document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (query.length < 2) {
        showError('Введіть щонайменше 2 символи для пошуку.');
        return;
    }
    
    isViewingFavorites = false; // Виходимо з режиму "Збережене"
    addToHistory(query);
    
    currentPage = 1;
    currentQuery = query;
    container.innerHTML = ''; 
    updateSectionTitle(`Шукаємо: "${query}"...`);
    
    showLoader(true);
    englishQuery = await translateToEnglish(query);
    fetchMovies();
    setActiveNav('navHome');
});

// 2. Фільтри
typeFilter.addEventListener('change', () => {
    currentType = typeFilter.value;
    if (!isViewingFavorites) resetAndSearch();
});

yearSort.addEventListener('change', () => {
    currentSort = yearSort.value;
    if (!isViewingFavorites) resetAndSearch();
});

ratingFilter.addEventListener('change', () => {
    minRating = parseFloat(ratingFilter.value);
    filterVisibleCardsByRating();
});

function resetAndSearch() {
    if (!englishQuery) return;
    currentPage = 1;
    container.innerHTML = '';
    fetchMovies();
}

// 3. Нескінченний скрол
function handleInfiniteScroll() {
    if (isViewingFavorites) return; // Не вантажимо нічого у "Збереженому"

    const endOfPage = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500;
    if (endOfPage && !isLoading && (currentPage * 10 < totalResults)) {
        currentPage++;
        fetchMovies();
    }
}

// 4. Кнопка "Вгору"
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.classList.add('show');
    else backToTopBtn.classList.remove('show');
});
backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 5. Навігація меню
document.getElementById('navHome').addEventListener('click', (e) => {
    e.preventDefault();
    isViewingFavorites = false;
    container.innerHTML = ''; 
    input.value = '';
    updateSectionTitle(''); 
    setActiveNav('navHome');
});

document.getElementById('navPopular').addEventListener('click', (e) => {
    e.preventDefault();
    isViewingFavorites = false;
    const randomQuery = popularKeywords[Math.floor(Math.random() * popularKeywords.length)];
    englishQuery = randomQuery;
    currentQuery = randomQuery;
    currentPage = 1; container.innerHTML = '';
    fetchMovies();
    updateSectionTitle(`Популярне: "${randomQuery}"`);
    setActiveNav('navPopular');
});

// --- ЛОГІКА "ЗБЕРЕЖЕНЕ" (Те, що у вас не працювало) ---
document.getElementById('navSaved').addEventListener('click', (e) => {
    e.preventDefault();
    showFavorites();
    setActiveNav('navSaved');
});

function showFavorites() {
    isViewingFavorites = true; // Вмикаємо режим
    container.innerHTML = '';
    updateSectionTitle('Ваша колекція ❤️');
    
    if (favoriteMovies.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center mt-5">
                <h3 class="text-white">Список порожній 😢</h3>
                <p class="text-secondary">Додайте фільми, натиснувши на серце.</p>
            </div>`;
        return;
    }
    renderMovies(favoriteMovies);
}

// --- API ---
async function fetchMovies() {
    if (isLoading) return;
    isLoading = true;
    showLoader(true);
    showError(null);

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                apikey: API_KEY,
                s: englishQuery,
                page: currentPage,
                type: currentType
            }
        });

        const data = response.data;
        if (data.Response === 'True') {
            totalResults = parseInt(data.totalResults);
            let movies = data.Search;

            if (currentSort === 'newest') movies.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
            else if (currentSort === 'oldest') movies.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));

            renderMovies(movies);
            
            if (currentPage === 1 && !isViewingFavorites) {
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

// Рейтинг
async function fetchRatingForMovie(imdbID, elementId, cardId) {
    try {
        const response = await axios.get(BASE_URL, { params: { apikey: API_KEY, i: imdbID } });
        const rating = parseFloat(response.data.imdbRating);
        const element = document.getElementById(elementId);
        const card = document.getElementById(cardId);
        
        if (element && !isNaN(rating)) {
            element.innerHTML = `<i class="bi bi-star-fill"></i> ${rating}`;
            card.setAttribute('data-rating', rating);
            if (rating < minRating) card.closest('.col').classList.add('d-none');
        } else if (element) {
            element.innerHTML = `<i class="bi bi-star"></i> -`;
            card.setAttribute('data-rating', 0);
        }
    } catch (e) { console.error(e); }
}

function filterVisibleCardsByRating() {
    document.querySelectorAll('.movie-card').forEach(card => {
        const rating = parseFloat(card.getAttribute('data-rating')) || 0;
        const col = card.closest('.col');
        rating >= minRating ? col.classList.remove('d-none') : col.classList.add('d-none');
    });
}

// --- РЕНДЕРИНГ ---
function renderMovies(movies) {
    if (!movies) return;
    const moviesHTML = movies.map(movie => {
        const isFav = favoriteMovies.some(fav => fav.imdbID === movie.imdbID);
        const heartClass = isFav ? 'active' : '';
        const heartIcon = isFav ? 'bi-heart-fill' : 'bi-heart';
        
        const movieData = encodeURIComponent(JSON.stringify({
            Title: movie.Title, Year: movie.Year, imdbID: movie.imdbID, Poster: movie.Poster
        }));

        fetchRatingForMovie(movie.imdbID, `rating-${movie.imdbID}`, `card-${movie.imdbID}`);

        return `
        <div class="col fade-in">
            <div id="card-${movie.imdbID}" class="card h-100 movie-card shadow-sm" data-rating="0">
                <div class="rating-badge" id="rating-${movie.imdbID}">
                    <div class="spinner-border spinner-border-sm text-warning" role="status"></div>
                </div>
                <button class="favorite-btn ${heartClass}" onclick="event.stopPropagation(); toggleFavorite('${movie.imdbID}', this)" data-movie="${movieData}">
                    <i class="bi ${heartIcon}"></i>
                </button>
                <div class="poster-wrapper">
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://placehold.co/300x450?text=No+Poster'}" 
                         alt="${movie.Title}" loading="lazy" class="card-img-top"
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
        </div>`;
    }).join('');
    container.insertAdjacentHTML('beforeend', moviesHTML);
}

// --- ДОПОМІЖНІ ФУНКЦІЇ ---
window.toggleFavorite = function(id, btnElement) {
    const movieData = JSON.parse(decodeURIComponent(btnElement.getAttribute('data-movie')));
    const index = favoriteMovies.findIndex(m => m.imdbID === id);
    const icon = btnElement.querySelector('i');
    
    if (index === -1) {
        favoriteMovies.push(movieData);
        btnElement.classList.add('active');
        icon.classList.replace('bi-heart', 'bi-heart-fill');
    } else {
        favoriteMovies.splice(index, 1);
        btnElement.classList.remove('active');
        icon.classList.replace('bi-heart-fill', 'bi-heart');
        // Якщо ми в режимі збережених - одразу прибираємо картку
        if (isViewingFavorites) {
            showFavorites(); 
        }
    }
    localStorage.setItem('favoriteMovies', JSON.stringify(favoriteMovies));
    updateSavedCount();
};

window.searchFromTag = function(query) {
    input.value = query;
    document.getElementById('searchForm').dispatchEvent(new Event('submit'));
};

function renderHistory() {
    const historyContainer = document.getElementById('historyContainer');
    if (searchHistory.length === 0) { historyContainer.innerHTML = ''; return; }
    historyContainer.innerHTML = searchHistory.map(q => 
        `<span class="badge badge-tag history-item" onclick="searchFromTag('${q}')">🕒 ${q}</span>`
    ).join('');
}

function addToHistory(query) {
    searchHistory = searchHistory.filter(item => item.toLowerCase() !== query.toLowerCase());
    searchHistory.unshift(query);
    if (searchHistory.length > 5) searchHistory.pop();
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderHistory();
}

function renderSeriesTags() {
    document.getElementById('seriesTags').innerHTML = popularSeries.map(s => 
        `<span class="badge badge-tag" onclick="searchFromTag('${s}')">📺 ${s}</span>`
    ).join('');
}

function showLoader(state) {
    state ? loader.classList.remove('d-none') : loader.classList.add('d-none');
}

function showError(msg) {
    const errorAlert = document.getElementById('errorAlert');
    if (msg) { errorAlert.textContent = msg; errorAlert.classList.remove('d-none'); } 
    else { errorAlert.classList.add('d-none'); }
}

function updateSavedCount() { savedCountBadge.innerText = favoriteMovies.length; }

function setActiveNav(id) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById(id);
    if(el) el.classList.add('active');
}

function updateSectionTitle(text) {
    if(!text) { sectionTitle.classList.add('d-none'); return; }
    sectionTitle.classList.remove('d-none');
    sectionTitle.innerText = text;
}