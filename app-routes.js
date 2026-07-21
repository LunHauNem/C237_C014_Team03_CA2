// Paste these routes into app.js AFTER the database connection
// and BEFORE app.listen(...).
//
// This code assumes your MySQL connection variable is called `db`.
// If your project uses `connection`, replace db.query with connection.query.

// HOMEPAGE
app.get('/', (req, res) => {
    const sql = `
        SELECT
            b.bookId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.description,
            b.image,
            c.categoryName
        FROM books b
        INNER JOIN categories c
            ON b.categoryId = c.categoryId
        ORDER BY b.bookId DESC
    `;

    db.query(sql, (error, books) => {
        if (error) {
            console.error('Error loading books:', error);
            return res.status(500).send('Unable to load the homepage.');
        }

        res.render('home', {
            pageTitle: 'Home',
            books,
            user: req.session ? req.session.user : null
        });
    });
});

// BOOK DESCRIPTION PAGE
app.get('/book/:bookId', (req, res) => {
    const bookId = req.params.bookId;

    const sql = `
        SELECT
            b.bookId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.description,
            b.image,
            c.categoryName
        FROM books b
        INNER JOIN categories c
            ON b.categoryId = c.categoryId
        WHERE b.bookId = ?
    `;

    db.query(sql, [bookId], (error, results) => {
        if (error) {
            console.error('Error loading book description:', error);
            return res.status(500).send('Unable to load the book.');
        }

        if (results.length === 0) {
            return res.status(404).render('bookNotFound', {
                pageTitle: 'Book Not Found',
                user: req.session ? req.session.user : null
            });
        }

        res.render('bookDescription', {
            pageTitle: results[0].title,
            book: results[0],
            user: req.session ? req.session.user : null
        });
    });
});
