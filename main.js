import axios from 'axios'; // [cite: 77]

// ВСТАВТЕ СЮДИ СВІЙ КЛЮЧ
const API_KEY = '4c611589'; 
const BASE_URL = 'https://www.omdbapi.com/';

// Елементи DOM [cite: 60]
const form = document.getElementById('searchForm');
const input = document.getElementById('searchInput');
const container = document.getElementById('moviesContainer');
const errorAlert = document.getElementById('errorAlert');
const loader = document.getElementById('loader');
const paginationNav = document.getElementById('paginationNav');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageIndicator = document.getElementById('pageIndicator');

// Елементи навігації
const navHome = document.getElementById('navHome');
const navPopular = document.getElementById('navPopular');
const navSaved = document.getElementById('navSaved');
const navBrand = document.getElementById('navBrand');

let currentPage = 1;
let currentQuery = '';
let totalResults = 0;

// Відновлення при завантаженні (LocalStorage) [cite: 93, 94]
document.addEventListener('DOMContentLoaded', () => {
    // При завантаженні просто показуємо пошук, не шукаємо автоматично,
    // поки користувач не натисне "Збережене" (за бажанням можна розкоментувати)
});

// --- ЛОГІКА НАВІГАЦІЇ ---

// Функція "Додому" - очищення
function goHome(e) {
    if(e) e.preventDefault();
    input.value = '';
    container.innerHTML = '';
    paginationNav.classList.add('d-none');
    showError(null);
    currentQuery = '';
    // Очищаємо активний клас у кнопок
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    navHome.classList.add('active');
}

navHome.addEventListener('click', goHome);
navBrand.addEventListener('click', goHome);

// Функція "Популярне" (імітація)
navPopular.addEventListener('click', (e) => {
    e.preventDefault();
    input.value = 'Harry Potter'; // Пресет популярного
    handleSearch('Harry Potter');
    setActiveNav(navPopular);
});

// Функція "Збережене" [cite: 43]
navSaved.addEventListener('click', (e) => {
    e.preventDefault();
    const savedQuery = localStorage.getItem('lastQuery');
    if (savedQuery) {
        input.value = savedQuery;
        handleSearch(savedQuery);
        setActiveNav(navSaved);
    } else {
        showError('Історія пошуку порожня. Знайдіть щось спочатку!');
        container.innerHTML = '';
        paginationNav.classList.add('d-none');
    }
});

function setActiveNav(element) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    element.classList.add('active');
}

// --- ОСНОВНИЙ ПОШУК ---

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (query.length < 3) { // [cite: 72]
        showError('Введіть мінімум 3 символи.');
        return;
    }
    handleSearch(query);
    setActiveNav(navHome); // Залишаємось на вкладці Home при пошуку
});

function handleSearch(query) {
    currentQuery = query;
    currentPage = 1;
    localStorage.setItem('lastQuery', currentQuery); // Збереження [cite: 43]
    fetchMovies(currentQuery, currentPage);
}

// Функція запиту до API [cite: 80, 24]
async function fetchMovies(query, page) {
    showLoader(true);
    showError(null);
    container.innerHTML = ''; 

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                apikey: API_KEY,
                s: query,
                page: page,
                type: 'movie'
            }
        });

        const data = response.data;

        if (data.Response === 'True') {
            totalResults = parseInt(data.totalResults);
            renderMovies(data.Search); 
            updatePagination(page, totalResults);
        } else {
            showError(data.Error || 'Фільми не знайдено');
            paginationNav.classList.add('d-none');
        }
    } catch (error) {
        showError('Помилка мережі: ' + error.message); // [cite: 85]
    } finally {
        showLoader(false);
    }
}

// Рендеринг (обмеження до 9 фільмів) [cite: 20]
function renderMovies(movies) {
    if (!movies) return;

    // Обрізаємо масив до 9 елементів
    const limitedMovies = movies.slice(0, 9); // [cite: 66]

    const moviesHTML = limitedMovies.map(movie => `
        <div class="col">
            <div class="card h-100 movie-card shadow-sm">
                <div class="poster-wrapper">
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster'}" 
                         alt="${movie.Title}">
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
    `).join('');
    
    container.innerHTML = moviesHTML;
}

// Пагінація [cite: 89]
function updatePagination(page, total) {
    paginationNav.classList.remove('d-none');
    pageIndicator.innerText = `Стор. ${page}`;
    
    prevBtn.disabled = page === 1;
    const totalPages = Math.ceil(total / 10);
    nextBtn.disabled = page >= totalPages;
}

prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        fetchMovies(currentQuery, currentPage);
        window.scrollTo(0, 0); // Прокрутка вгору
    }
});

nextBtn.addEventListener('click', () => {
    currentPage++;
    fetchMovies(currentQuery, currentPage);
    window.scrollTo(0, 0);
});

// Утиліти
function showLoader(isLoading) {
    isLoading ? loader.classList.remove('d-none') : loader.classList.add('d-none');
}

function showError(msg) {
    if (msg) {
        errorAlert.textContent = msg;
        errorAlert.classList.remove('d-none');
    } else {
        errorAlert.classList.add('d-none');
    }
}