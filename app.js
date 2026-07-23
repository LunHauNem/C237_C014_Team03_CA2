// Import the packages required by the application.
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');

// Create the Express application.
const app = express();

// Render will provide its own port.
// Port 3000 is used when running locally.
const PORT = process.env.PORT || 3000;


// ==========================================================
// DATABASE CONNECTION
// ==========================================================

// Connect the application to the Azure MySQL database.
const db = mysql.createConnection({
    host: 'c237-marlina-mysql.mysql.database.azure.com',
    user: 'c237_014',
    password: 'c237014@2026!',
    database: 'c237_014_team3_ca2',
    ssl: {
        rejectUnauthorized: false
    }
});

// Test the database connection when the application starts.
db.connect((error) => {
    if (error) {
        console.error('MySQL connection failed:');
        console.error(error.message);
        return;
    }

    console.log('Connected to MySQL database');
});


// ==========================================================
// EXPRESS SETTINGS
// ==========================================================

// Use EJS as the view engine.
app.set('view engine', 'ejs');

// Tell Express where the views folder is located.
app.set(
    'views',
    path.join(__dirname, 'views')
);

// Allow Express to receive data submitted through HTML forms.
app.use(
    express.urlencoded({
        extended: true
    })
);

// Allow Express to receive JSON data.
app.use(express.json());

// Allow access to CSS, JavaScript and images
// stored inside the public folder.
app.use(
    express.static(
        path.join(__dirname, 'public')
    )
);


// ==========================================================
// SESSION SETUP
// ==========================================================

// Store login information in a session.
app.use(
    session({
        secret: 'team03-library-secret',
        resave: false,
        saveUninitialized: false,

        // The session remains active for one day.
        cookie: {
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);


// ==========================================================
// SHARED EJS VARIABLES
// ==========================================================

// Make session information available in all EJS pages.
app.use((req, res, next) => {
    // Provide the logged-in user to every EJS file.
    res.locals.user =
        req.session.user || null;

    // Provide one-time success and error messages.
    res.locals.successMessage =
        req.session.successMessage || null;

    res.locals.errorMessage =
        req.session.errorMessage || null;

    // Delete the messages after they have been displayed once.
    delete req.session.successMessage;
    delete req.session.errorMessage;

    next();
});


// ==========================================================
// AUTHENTICATION MIDDLEWARE
// ==========================================================

// Check whether the visitor is logged in.
function checkAuthenticated(req, res, next) {
    // Continue to the requested route when logged in.
    if (req.session.user) {
        return next();
    }

    // Store an error message for the login page.
    req.session.errorMessage =
        'Please log in to access this page.';

    // Redirect guests to the login page.
    return res.redirect('/login');
}

function checkMember(req, res, next) {
    if (
        req.session.user &&
        req.session.user.role === 'member'
    ) {
        return next();
    }

    req.session.errorMessage =
        'Member access only.';

    return res.redirect('/');
}

// Check whether the logged-in user is an administrator.
function checkAdmin(req, res, next) {
    // Allow access only when the role is admin.
    if (
        req.session.user &&
        req.session.user.role === 'admin'
    ) {
        return next();
    }

    // Store an access-denied message.
    req.session.errorMessage =
        'Admin access only.';

    // Redirect non-admin users to the homepage.
    return res.redirect('/');
}


// ==========================================================
// HOMEPAGE AND BOOK SEARCH
// ==========================================================

function showHomepage(req, res) {
    // Get search text from the URL.
    const search = (
        req.query.search || ''
    ).trim();

    // Get selected category ID from the URL.
    const selectedGenre =
        req.query.genre || 'all';

    // Base query for books.
    let booksSql = `
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
        INNER JOIN categories c
            ON b.categoryId = c.categoryId
    `;

    const conditions = [];
    const values = [];

    // Search by title or author.
    if (search !== '') {
        conditions.push(`
            (
                b.title LIKE ?
                OR b.author LIKE ?
            )
        `);

        const searchValue = `%${search}%`;

        values.push(
            searchValue,
            searchValue
        );
    }

    // Filter using category ID.
    if (
        selectedGenre !== 'all' &&
        selectedGenre !== ''
    ) {
        const categoryId = Number.parseInt(
            selectedGenre,
            10
        );

        if (Number.isInteger(categoryId)) {
            conditions.push(
                'b.categoryId = ?'
            );

            values.push(categoryId);
        }
    }

    // Add WHERE only when conditions exist.
    if (conditions.length > 0) {
        booksSql += `
            WHERE ${conditions.join(' AND ')}
        `;
    }

    booksSql += `
        ORDER BY b.bookId DESC
    `;

    // Query for category dropdown.
    const categoriesSql = `
        SELECT
            categoryId,
            categoryName
        FROM categories
        ORDER BY categoryName ASC
    `;

    db.query(
        categoriesSql,
        (categoryError, categories) => {
            if (categoryError) {
                console.error(
                    'Error loading categories:',
                    categoryError
                );

                return res.status(500).send(
                    'Unable to load the categories.'
                );
            }

            db.query(
                booksSql,
                values,
                (bookError, books) => {
                    if (bookError) {
                        console.error(
                            'Error loading books:',
                            bookError.message
                        );

                        console.error(
                            'SQL query:',
                            booksSql
                        );

                        console.error(
                            'SQL values:',
                            values
                        );

                        return res.status(500).send(
                            'Unable to load the books.'
                        );
                    }

                    return res.render('home', {
                        pageTitle: 'Home',
                        books: books,
                        categories: categories,
                        search: search,
                        selectedGenre:
                            selectedGenre
                    });
                }
            );
        }
    );
}

// Display the homepage.
app.get('/', showHomepage);

// Display filtered or searched books.
app.get('/books', showHomepage);


// ==========================================================
// BOOK DESCRIPTION PAGE
// ==========================================================

// Display one book using its book ID.
app.get('/book/:bookId', (req, res) => {
    // Convert the book ID from text to an integer.
    const bookId = Number.parseInt(
        req.params.bookId,
        10
    );

    // Reject an invalid book ID.
    if (
        !Number.isInteger(bookId) ||
        bookId <= 0
    ) {
        return res.status(404).render(
            'bookNotFound',
            {
                pageTitle: 'Book Not Found'
            }
        );
    }

    // Retrieve the selected book and its category.
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

        // Display the not-found page when no book exists.
        if (results.length === 0) {
            return res.status(404).render(
                'bookNotFound',
                {
                    pageTitle:
                        'Book Not Found'
                }
            );
        }

        // Display the selected book.
        return res.render(
            'bookDescription',
            {
                pageTitle:
                    results[0].title,
                book: results[0]
            }
        );
    });
});

// ==========================================================
// BORROW A BOOK
// ==========================================================

app.post(
    '/borrow/:bookId',
    checkAuthenticated,
    checkMember,
    (req, res) => {
        const bookId = Number.parseInt(
            req.params.bookId,
            10
        );

        const userId =
            req.session.user.userId;

        if (
            !Number.isInteger(bookId) ||
            bookId <= 0
        ) {
            req.session.errorMessage =
                'Invalid book selected.';

            return res.redirect('/');
        }

        // Check whether the book exists
        // and whether a copy is available.
        const checkBookSql = `
            SELECT
                bookId,
                title,
                availableQuantity
            FROM books
            WHERE bookId = ?
        `;

        db.query(
            checkBookSql,
            [bookId],
            (bookError, books) => {
                if (bookError) {
                    console.error(
                        'Error checking book:',
                        bookError
                    );

                    req.session.errorMessage =
                        'Unable to borrow the book.';

                    return res.redirect(
                        `/book/${bookId}`
                    );
                }

                if (books.length === 0) {
                    req.session.errorMessage =
                        'Book not found.';

                    return res.redirect('/');
                }

                const book = books[0];

                if (book.availableQuantity <= 0) {
                    req.session.errorMessage =
                        'This book is currently unavailable.';

                    return res.redirect(
                        `/book/${bookId}`
                    );
                }

                // Prevent the same member from borrowing
                // the same book more than once before returning it.
                const duplicateSql = `
                    SELECT borrowId
                    FROM borrow_records
                    WHERE userId = ?
                      AND bookId = ?
                      AND status = 'borrowed'
                `;

                db.query(
                    duplicateSql,
                    [userId, bookId],
                    (duplicateError, records) => {
                        if (duplicateError) {
                            console.error(
                                'Error checking borrowing:',
                                duplicateError
                            );

                            req.session.errorMessage =
                                'Unable to borrow the book.';

                            return res.redirect(
                                `/book/${bookId}`
                            );
                        }

                        if (records.length > 0) {
                            req.session.errorMessage =
                                'You have already borrowed this book.';

                            return res.redirect(
                                '/my-borrowings'
                            );
                        }

                        const insertBorrowSql = `
                            INSERT INTO borrow_records
                            (
                                userId,
                                bookId,
                                borrowDate,
                                dueDate,
                                returnDate,
                                status
                            )
                            VALUES
                            (
                                ?,
                                ?,
                                CURDATE(),
                                DATE_ADD(
                                    CURDATE(),
                                    INTERVAL 14 DAY
                                ),
                                NULL,
                                'borrowed'
                            )
                        `;

                        db.query(
                            insertBorrowSql,
                            [userId, bookId],
                            (insertError) => {
                                if (insertError) {
                                    console.error(
                                        'Error creating borrow record:',
                                        insertError
                                    );

                                    req.session.errorMessage =
                                        'Unable to borrow the book.';

                                    return res.redirect(
                                        `/book/${bookId}`
                                    );
                                }

                                const updateBookSql = `
                                    UPDATE books
                                    SET availableQuantity =
                                        availableQuantity - 1
                                    WHERE bookId = ?
                                      AND availableQuantity > 0
                                `;

                                db.query(
                                    updateBookSql,
                                    [bookId],
                                    (updateError) => {
                                        if (updateError) {
                                            console.error(
                                                'Error updating book quantity:',
                                                updateError
                                            );

                                            req.session.errorMessage =
                                                'Borrow record was created, but book quantity could not be updated.';

                                            return res.redirect(
                                                '/my-borrowings'
                                            );
                                        }

                                        req.session.successMessage =
                                            `"${book.title}" borrowed successfully.`;

                                        return res.redirect(
                                            '/my-borrowings'
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);


// ==========================================================
// REGISTRATION
// ==========================================================

// Display the registration page.
app.get('/register', (req, res) => {
    // Logged-in users do not need to register again.
    if (req.session.user) {
        return res.redirect('/');
    }

    return res.render('register', {
        pageTitle: 'Register',
        formData: {}
    });
});

// Process registration form submission.
app.post('/register', async (req, res) => {
    // Retrieve values submitted by the registration form.
    const {
        name,
        email,
        password,
        confirmPassword
    } = req.body;

    // Preserve the name and email if validation fails.
    const formData = {
        name: name || '',
        email: email || ''
    };

    // Check whether all fields were completed.
    if (
        !name ||
        !email ||
        !password ||
        !confirmPassword
    ) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'All fields are required.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Remove spaces around the name.
    const cleanName = name.trim();

    // Convert the email to lowercase.
    const normalizedEmail =
        email.trim().toLowerCase();

    // Validate the member's name.
    if (cleanName.length < 2) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Name must contain at least 2 characters.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Require a password with at least six characters.
    if (password.length < 6) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Password must contain at least 6 characters.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Ensure both password fields match.
    if (password !== confirmPassword) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Passwords do not match.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Check whether the email already exists.
    const checkEmailSql = `
        SELECT userId
        FROM users
        WHERE email = ?
    `;

    db.query(
        checkEmailSql,
        [normalizedEmail],
        async (error, results) => {
            if (error) {
                console.error(
                    'Error checking email:',
                    error
                );

                return res.status(500).render(
                    'register',
                    {
                        pageTitle: 'Register',
                        errorMessage:
                            'Unable to register at the moment.',
                        successMessage: null,
                        formData: formData
                    }
                );
            }

            // Stop when the email is already registered.
            if (results.length > 0) {
                return res.status(400).render(
                    'register',
                    {
                        pageTitle: 'Register',
                        errorMessage:
                            'This email is already registered.',
                        successMessage: null,
                        formData: formData
                    }
                );
            }

            try {
                // Securely hash the password before saving it.
                const hashedPassword =
                    await bcrypt.hash(
                        password,
                        10
                    );

                // Insert the new account as a member.
                const insertUserSql = `
                    INSERT INTO users
                    (
                        name,
                        email,
                        password,
                        role
                    )
                    VALUES (?, ?, ?, ?)
                `;

                db.query(
                    insertUserSql,
                    [
                        cleanName,
                        normalizedEmail,
                        hashedPassword,
                        'member'
                    ],
                    (insertError) => {
                        if (insertError) {
                            console.error(
                                'Registration error:',
                                insertError
                            );

                            return res
                                .status(500)
                                .render(
                                    'register',
                                    {
                                        pageTitle:
                                            'Register',
                                        errorMessage:
                                            'Registration failed.',
                                        successMessage:
                                            null,
                                        formData:
                                            formData
                                    }
                                );
                        }

                        // Show a success message on the login page.
                        req.session.successMessage =
                            'Registration successful. Please log in.';

                        return res.redirect('/login');
                    }
                );
            } catch (hashError) {
                console.error(
                    'Password hashing error:',
                    hashError
                );

                return res.status(500).render(
                    'register',
                    {
                        pageTitle: 'Register',
                        errorMessage:
                            'Registration failed.',
                        successMessage: null,
                        formData: formData
                    }
                );
            }
        }
    );
});


// ==========================================================
// LOGIN
// ==========================================================

// Display the login page.
app.get('/login', (req, res) => {
    // Redirect users who are already logged in.
    if (req.session.user) {
        return res.redirect('/');
    }

    return res.render('login', {
        pageTitle: 'Login'
    });
});

// Process the login form.
app.post('/login', (req, res) => {
    // Retrieve the submitted login details.
    const {
        email,
        password
    } = req.body;

    // Validate the submitted fields.
    if (!email || !password) {
        return res.status(400).render(
            'login',
            {
                pageTitle: 'Login',
                errorMessage:
                    'Email and password are required.',
                successMessage: null
            }
        );
    }

    // Standardise the email format.
    const normalizedEmail =
        email.trim().toLowerCase();

    // Find the user using their email address.
    const sql = `
        SELECT
            userId,
            name,
            email,
            password,
            role
        FROM users
        WHERE email = ?
    `;

    db.query(
        sql,
        [normalizedEmail],
        async (error, results) => {
            if (error) {
                console.error(
                    'Login database error:',
                    error
                );

                return res.status(500).render(
                    'login',
                    {
                        pageTitle: 'Login',
                        errorMessage:
                            'Unable to log in at the moment.',
                        successMessage: null
                    }
                );
            }

            // Use a general error message for an unknown email.
            if (results.length === 0) {
                return res.status(401).render(
                    'login',
                    {
                        pageTitle: 'Login',
                        errorMessage:
                            'Invalid email or password.',
                        successMessage: null
                    }
                );
            }

            const user = results[0];

            try {
                // Compare the entered password with the stored hash.
                const passwordMatches =
                    await bcrypt.compare(
                        password,
                        user.password
                    );

                // Reject an incorrect password.
                if (!passwordMatches) {
                    return res.status(401).render(
                        'login',
                        {
                            pageTitle: 'Login',
                            errorMessage:
                                'Invalid email or password.',
                            successMessage: null
                        }
                    );
                }

                // Store only the required user information.
                // Do not store the password in the session.
                req.session.user = {
                    userId: user.userId,
                    name: user.name,
                    email: user.email,
                    role: user.role
                };

                // Store a one-time welcome message.
                req.session.successMessage =
                    `Welcome back, ${user.name}!`;

                // Send administrators to the admin dashboard.
                if (user.role === 'admin') {
                    return res.redirect('/admin');
                }

                // Send members to the homepage.
                return res.redirect('/');
            } catch (compareError) {
                console.error(
                    'Password comparison error:',
                    compareError
                );

                return res.status(500).render(
                    'login',
                    {
                        pageTitle: 'Login',
                        errorMessage:
                            'Unable to log in.',
                        successMessage: null
                    }
                );
            }
        }
    );
});


// ==========================================================
// LOGOUT
// ==========================================================

// Log out the current user.
app.get('/logout', (req, res) => {
    // Remove all session information.
    req.session.destroy((error) => {
        if (error) {
            console.error(
                'Logout error:',
                error
            );

            return res.status(500).send(
                'Unable to log out.'
            );
        }

        // Delete the session cookie.
        res.clearCookie('connect.sid');

        // Return to the public homepage.
        return res.redirect('/');
    });
});

// ==========================================================
// MY BORROWINGS
// ==========================================================

app.get(
    '/my-borrowings',
    checkAuthenticated,
    checkMember,
    (req, res) => {
        const userId =
            req.session.user.userId;

        const sql = `
            SELECT
                br.borrowId,
                br.bookId,
                br.borrowDate,
                br.dueDate,
                br.returnDate,
                br.status,
                b.title,
                b.author,
                b.image,
                c.categoryName
            FROM borrow_records br
            INNER JOIN books b
                ON br.bookId = b.bookId
            INNER JOIN categories c
                ON b.categoryId = c.categoryId
            WHERE br.userId = ?
            ORDER BY
                br.status ASC,
                br.borrowDate DESC
        `;

        db.query(
            sql,
            [userId],
            (error, borrowings) => {
                if (error) {
                    console.error(
                        'Error loading borrowings:',
                        error
                    );

                    return res.status(500).send(
                        'Unable to load your borrowings.'
                    );
                }

                const currentBorrowings =
                    borrowings.filter(
                        record =>
                            record.status ===
                            'borrowed'
                    );

                const borrowingHistory =
                    borrowings.filter(
                        record =>
                            record.status ===
                            'returned'
                    );

                return res.render(
                    'myBorrowings',
                    {
                        pageTitle:
                            'My Borrowings',
                        currentBorrowings:
                            currentBorrowings,
                        borrowingHistory:
                            borrowingHistory
                    });
            }
        );
    }
);

// ==========================================================
// RETURN A BOOK
// ==========================================================

app.post(
    '/return/:borrowId',
    checkAuthenticated,
    checkMember,
    (req, res) => {
        const borrowId = Number.parseInt(
            req.params.borrowId,
            10
        );

        const userId =
            req.session.user.userId;

        if (
            !Number.isInteger(borrowId) ||
            borrowId <= 0
        ) {
            req.session.errorMessage =
                'Invalid borrowing record.';

            return res.redirect(
                '/my-borrowings'
            );
        }

        // Ensure the borrowing belongs
        // to the logged-in member.
        const checkBorrowSql = `
            SELECT
                br.borrowId,
                br.bookId,
                br.status,
                b.title
            FROM borrow_records br
            INNER JOIN books b
                ON br.bookId = b.bookId
            WHERE br.borrowId = ?
              AND br.userId = ?
        `;

        db.query(
            checkBorrowSql,
            [borrowId, userId],
            (checkError, records) => {
                if (checkError) {
                    console.error(
                        'Error checking borrowing:',
                        checkError
                    );

                    req.session.errorMessage =
                        'Unable to return the book.';

                    return res.redirect(
                        '/my-borrowings'
                    );
                }

                if (records.length === 0) {
                    req.session.errorMessage =
                        'Borrowing record not found.';

                    return res.redirect(
                        '/my-borrowings'
                    );
                }

                const record = records[0];

                if (record.status === 'returned') {
                    req.session.errorMessage =
                        'This book has already been returned.';

                    return res.redirect(
                        '/my-borrowings'
                    );
                }

                const updateBorrowSql = `
                    UPDATE borrow_records
                    SET
                        returnDate = CURDATE(),
                        status = 'returned'
                    WHERE borrowId = ?
                      AND userId = ?
                      AND status = 'borrowed'
                `;

                db.query(
                    updateBorrowSql,
                    [borrowId, userId],
                    (updateBorrowError) => {
                        if (updateBorrowError) {
                            console.error(
                                'Error returning book:',
                                updateBorrowError
                            );

                            req.session.errorMessage =
                                'Unable to return the book.';

                            return res.redirect(
                                '/my-borrowings'
                            );
                        }

                        const updateBookSql = `
                            UPDATE books
                            SET availableQuantity =
                                availableQuantity + 1
                            WHERE bookId = ?
                        `;

                        db.query(
                            updateBookSql,
                            [record.bookId],
                            (updateBookError) => {
                                if (updateBookError) {
                                    console.error(
                                        'Error restoring book quantity:',
                                        updateBookError
                                    );

                                    req.session.errorMessage =
                                        'Return was recorded, but the available quantity could not be updated.';

                                    return res.redirect(
                                        '/my-borrowings'
                                    );
                                }

                                req.session.successMessage =
                                    `"${record.title}" returned successfully.`;

                                return res.redirect(
                                    '/my-borrowings'
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);

// ==========================================================
// ADMIN ROUTES
// ==========================================================

// Middleware to allow only logged-in administrators.
function adminOnly(req, res, next) {
    checkAuthenticated(req, res, () => {
        checkAdmin(req, res, next);
    });
}


// ==========================================================
// ADMIN DASHBOARD (UPDATED: Real-time statistics)
// ==========================================================

app.get('/admin', adminOnly, (req, res) => {
    // Object to hold library statistics
    const stats = {
        totalBooks: 0,
        totalMembers: 0,
        totalBorrowed: 0,
        totalOverdue: 0,
        unpaidFines: 0
    };

    // Count total books
    db.query('SELECT COUNT(*) AS count FROM books', (e1, bResult) => {
        stats.totalBooks = bResult[0].count;

        // Count total member accounts
        db.query(`SELECT COUNT(*) AS count FROM users WHERE role = 'member'`, (e2, mResult) => {
            stats.totalMembers = mResult[0].count;

            // Count currently borrowed books (status = borrowed)
            db.query(`
                SELECT COUNT(*) AS count
                FROM borrow_records
                WHERE status = 'borrowed'
            `, (e3, brResult) => {
                stats.totalBorrowed = brResult[0].count;

                res.render('admin/dashboard', {
                    pageTitle: 'Admin Dashboard',
                    user: req.session.user,
                    stats,
                    currentPage: 'dashboard'
                });
            });
        });
    });
});

app.get('/admin/dashboard', adminOnly, (req, res) => {
    res.redirect('/admin');
});

// ==========================================================
// ADMIN ALL BORROW RECORDS ROUTE (NEW FEATURE)
// Show every borrow record in system for administrator
// ==========================================================
app.get('/admin/borrow-history', adminOnly, (req, res) => {
    // Join borrow_records, users, books, categories
    const sql = `
        SELECT
            br.borrowId,
            br.borrowDate,
            br.dueDate,
            br.returnDate,
            br.status,
            u.userId,
            u.name,
            b.title,
            b.author,
            c.categoryName
        FROM borrow_records br
        INNER JOIN users u ON br.userId = u.userId
        INNER JOIN books b ON br.bookId = b.bookId
        LEFT JOIN categories c ON b.categoryId = c.categoryId
        ORDER BY br.borrowDate DESC
    `;

    db.query(sql, (err, records) => {
        if (err) {
            console.error('Error loading all borrow history:', err);
            return res.status(500).send('Error loading borrow history');
        }
        // Render view inside admin folder
        res.render('admin/borrowHistory', {
            pageTitle: 'All Borrow History',
            records: records,
            user: req.session.user,
            currentPage: ''
        });
    });
});

// ==========================================================
// BOOK LIST
// ==========================================================

app.get('/admin/books', adminOnly, (req, res) => {

    const search = (req.query.search || '').trim();

    const sql = `
        SELECT
            b.bookId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.categoryId,
            c.categoryName
        FROM books b
        INNER JOIN categories c
            ON b.categoryId = c.categoryId
        WHERE
            b.title LIKE ?
            OR b.author LIKE ?
            OR b.isbn LIKE ?
        ORDER BY b.bookId DESC
    `;

    const keyword = `%${search}%`;

    db.query(sql, [keyword, keyword, keyword], (err, books) => {

        if (err) {
            console.error(err);
            return res.status(500).send('Unable to load books.');
        }

        res.render('admin/books', {
            pageTitle: 'Book List',
            books,
            search,
            user: req.session.user,
            currentPage: 'books'
        });

    });

});


// ==========================================================
// ADD BOOK
// ==========================================================
app.get(
    '/admin/books/add',
    adminOnly,
    (req, res) => {
        db.query(
            `SELECT categoryId, categoryName
            FROM categories
            ORDER BY categoryName
            `,
            (error, categories) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Unable to load categories.');
                }
                res.render('addBook', {
                    pageTitle: 'Add Book',
                    error: '',
                    categories,
                    user: req.session.user
                });
            });
    });

app.post(
    '/admin/books/add',
    adminOnly,
    (req, res) => {
        const {
            title,
            author,
            isbn,
            quantity,
            availableQuantity,
            description,
            image,
            categoryId
        } = req.body;
        const sql = `
            INSERT INTO books
            (
                title,
                author,
                isbn,
                quantity,
                availableQuantity,
                description,
                image,
                categoryId
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(
            sql,
            [
                title,
                author,
                isbn,
                quantity,
                availableQuantity,
                description,
                image,
                categoryId
            ],
            (error) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Unable to add book.');
                }
                req.session.successMessage =
                    'Book added successfully.';
                res.redirect('/admin/books');
            }
        );
    });

// ==========================================================
// EDIT BOOK
// ==========================================================

// Show edit form
app.get('/admin/books/edit/:bookId', adminOnly, (req, res) => {
    db.query(
        `
        SELECT *
        FROM books
        WHERE bookId = ?
        `,
        [req.params.bookId],
        (err, bookResult) => {
            if (err || bookResult.length === 0) {
                return res.status(404).send('Book not found.');
            }

            db.query(
                'SELECT * FROM categories ORDER BY categoryName',
                (err2, categories) => {
                    if (err2) {
                        return res.status(500).send('Database Error');
                    }

                    res.render('admin/editBook', {
                        pageTitle: 'Edit Book',
                        book: bookResult[0],
                        categories,
                        user: req.session.user,
                        currentPage: 'books'
                    });
                }
            );
        }
    );
});

// Save changes
app.post('/admin/books/edit/:bookId', adminOnly, (req, res) => {
    const {
        title,
        author,
        isbn,
        quantity,
        availableQuantity,
        description,
        image,
        categoryId
    } = req.body;

    db.query(
        `
        UPDATE books
        SET
            title=?,
            author=?,
            isbn=?,
            quantity=?,
            availableQuantity=?,
            description=?,
            image=?,
            categoryId=?
        WHERE bookId=?
        `,
        [
            title,
            author,
            isbn,
            quantity,
            availableQuantity,
            description,
            image,
            categoryId,
            req.params.bookId
        ],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Unable to update book.');
            }

            res.redirect('/admin/books');
        }
    );
});

// ==========================================================
// DELETE BOOK
// ==========================================================

app.post('/admin/books/delete/:bookId', adminOnly, (req, res) => {

    db.query(
        'DELETE FROM books WHERE bookId = ?',
        [req.params.bookId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Unable to delete book.');
            }
            res.redirect('/admin/books');
        }
    );
});

// ==========================================================
// MEMBER LIST
// ==========================================================

app.get('/admin/members', adminOnly, (req, res) => {

    const search = (req.query.search || '').trim();

    const sql = `
        SELECT
            userId,
            name,
            email,
            role,
            createdAt
        FROM users
        WHERE
            name LIKE ?
            OR email LIKE ?
        ORDER BY userId DESC
    `;

    const keyword = `%${search}%`;

    db.query(sql, [keyword, keyword], (err, members) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Unable to load members.');
        }

        res.render('admin/members', {
            pageTitle: 'Member List',
            members,
            search,
            user: req.session.user,
            currentPage: 'members'
        });
    });
});

// ==========================================================
// ADD MEMBER
// ==========================================================

// Show add member form
app.get('/admin/members/add', adminOnly, (req, res) => {
    res.render('admin/memberForm', {
        pageTitle: 'Add Member',
        formMode: 'add',
        member: null,
        user: req.session.user,
        currentPage: 'members'
    });
});

// Process add member form submit
app.post('/admin/members/add', adminOnly, (req, res) => {
    const { name, email, password, role } = req.body;
    db.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, password, role],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Unable to add member.');
            }
            res.redirect('/admin/members');
        }
    );
});

// ==========================================================
// EDIT MEMBER
// ==========================================================

// Show edit member form
app.get('/admin/members/edit/:userId', adminOnly, (req, res) => {
    db.query(
        'SELECT * FROM users WHERE userId = ?',
        [req.params.userId],
        (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).send('Member not found.');
            }

            res.render('admin/editMember', {
                pageTitle: 'Edit Member',
                member: results[0],
                user: req.session.user,
                currentPage: 'members'
            });
        }
    );
});

// Process edit member form submit
app.post('/admin/members/edit/:userId', adminOnly, (req, res) => {
    const { name, email, role } = req.body;
    db.query(
        `
        UPDATE users
        SET
            name = ?,
            email = ?,
            role = ?
        WHERE userId = ?
        `,
        [name, email, role, req.params.userId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Unable to update member.');
            }
            res.redirect('/admin/members');
        }
    );
});

// ==========================================================
// DELETE MEMBER
// ==========================================================

app.post('/admin/members/delete/:userId', adminOnly, (req, res) => {
    if (Number(req.params.userId) === req.session.user.userId) {
        return res.status(400).send('You cannot delete your own account.');
    }

    db.query(
        'DELETE FROM users WHERE userId = ?',
        [req.params.userId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Unable to delete member.');
            }
            res.redirect('/admin/members');
        }
    );
});

// ==========================================================
// ADMIN PROFILE
// ==========================================================

// Show profile
app.get('/admin/profile', adminOnly, (req, res) => {
    res.render('admin/profile', {
        pageTitle: 'My Profile',
        user: req.session.user,
        currentPage: 'profile'
    });
});

// ==========================================================
// PAGE NOT FOUND
// ==========================================================

// This must remain after all other application routes.
app.use((req, res) => {
    res.status(404).send(`
        <h2>Page Not Found</h2>
        <p>The requested page does not exist.</p>
        <a href="/">Return to homepage</a>
    `);
});

// ==========================================================
// START SERVER
// ==========================================================

// Start the Express server.
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});