const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// ==========================================
// DATABASE CONNECTION
// ==========================================

const db = mysql.createConnection({
    host: 'c237-marlina-mysql.mysql.database.azure.com',
    user: 'c237_014',
    password: 'c237014@2026!',
    database: 'c237_014_team3_ca2',
    ssl:{rejectUnauthorized:false}
});

db.connect((error) => {
    if (error) {
        console.error('MySQL connection failed:');
        console.error(error.message);
        return;
    }

    console.log('Connected to MySQL database');
});

// ==========================================
// EXPRESS SETTINGS
// ==========================================

app.set('view engine', 'ejs');

app.set(
    'views',
    path.join(__dirname, 'views')
);

// Allows form data to be received.
app.use(express.urlencoded({
    extended: true
}));

app.use(express.json());

// Allows the website to access CSS and images
// inside the public folder.
app.use(
    express.static(
        path.join(__dirname, 'public')
    )
);

// Session setup for login information.
app.use(
    session({
        secret: 'team03-library-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);


function showHomepage(req, res) {
    const search = (req.query.search || '').trim();
    const filterGenre = req.query.genre || 'all';

    let sql = `
        SELECT
            b.bookId,
            b.categoryId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.description,
            b.image,
            c.categoryName
        FROM books b
        INNER JOIN categories c ON b.categoryId = c.categoryId
        WHERE 1=1
    `;
    const values = [];

    if (search !== '') {
        sql += ` AND (b.title LIKE ? OR b.author LIKE ? OR c.categoryName LIKE ?)`;
        const searchValue = `%${search}%`;
        values.push(searchValue, searchValue, searchValue);
    }

    if (filterGenre !== 'all') {
        sql += ` AND c.categoryName = ?`;
        values.push(filterGenre);
    }

    sql += ` ORDER BY b.bookId DESC`;

    db.query(sql, values, (error, books) => {
        if (error) {
            console.error('Error loading homepage:', error);
            return res.status(500).send('Unable to load the books.');
        }

        db.query(`SELECT DISTINCT categoryName FROM categories ORDER BY categoryName`, (catErr, categories) => {
            if(catErr) console.error("分类加载失败", catErr);
            res.render('home', {
                pageTitle: 'Home',
                books: books,
                search: search,
                selectedGenre: filterGenre,
                categories: categories,
                user: req.session.user || null
            });
        });
    });
}

app.get('/', showHomepage);
app.get('/books', showHomepage);

// ==========================================
// BOOK DESCRIPTION PAGE
// ==========================================
app.get('/book/:bookId', (req, res) => {
    const bookId = Number.parseInt(req.params.bookId, 10);

    if (!Number.isInteger(bookId) || bookId <= 0) {
        return res.status(404).render('bookNotFound', {
            pageTitle: 'Book Not Found',
            user: req.session.user || null
        });
    }

    const sql = `
        SELECT
            b.bookId,
            b.categoryId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.description,
            b.image,
            c.categoryName
        FROM books b
        INNER JOIN categories c ON b.categoryId = c.categoryId
        WHERE b.bookId = ?
    `;

    db.query(sql, [bookId], (error, results) => {
        if (error) {
            console.error('Error loading book:', error);
            return res.status(500).send('Unable to load this book.');
        }

        if (results.length === 0) {
            return res.status(404).render('bookNotFound', {
                pageTitle: 'Book Not Found',
                user: req.session.user || null
            });
        }

        res.render('bookDescription', {
            pageTitle: results[0].title,
            book: results[0],
            user: req.session.user || null
        });
    });
});

// ==========================================
// TEMPORARY BORROW ROUTE
// ==========================================
app.post('/borrow/:bookId', (req, res) => {
    res.send(`
        <h2>Borrowing function not connected yet.</h2>
        <p>Selected book ID: ${req.params.bookId}</p>
        <a href="/">Return to homepage</a>
    `);
});

// ==========================================
// TEMPORARY LOGIN AND REGISTRATION ROUTES
// ==========================================
app.get('/login', (req, res) => {
    res.send(`
        <h2>Login Page</h2>
        <p>Shaine is working on this page.</p>
        <a href="/">Return to homepage</a>
    `);
});

app.get('/register', (req, res) => {
    res.send(`
        <h2>Registration Page</h2>
        <p>Calista and Shaine are working on this page.</p>
        <a href="/">Return to homepage</a>
    `);
});

app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error('Logout error:', error);
        }
        res.redirect('/');
    });
});

// ==========================================
// PAGE NOT FOUND
// ==========================================
app.use((req, res) => {
    res.status(404).send(`
        <h2>Page Not Found</h2>
        <a href="/">Return to homepage</a>
    `);
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
