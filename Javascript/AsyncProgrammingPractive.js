////////////////////// Remember: //////////////////////
// await = "Wait for this promise to complete"
// async = "This function can use await"
// try/catch = "Handle errors from await"
// Promise.all() = "Wait for multiple promises in parallel"
// Await makes async code look and behave like synchronous code, but without blocking!


const promise = new Promise((resolve, reject) => {
    console.log("Promise is pending");
    setTimeout(() => {
        console.log("Promise is resolved");
        resolve(true);
    }, 1000);
});

promise.then((result) => {
    console.log(result);
});



async function fetchData() {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    const data = await response.json();
    console.log(data);
}

fetchData();





// If ANY promise fails, Promise.all() FAILS immediately
async function testPromiseAll() {
    try {
        const results = await Promise.all([
            fetch('/api/user/1'),        // Success
            fetch('/api/user/999'),      // Fails (404)
            fetch('/api/user/3')         // Never executed
        ]);
        console.log('All succeeded:', results);
    } catch (error) {
        console.log('One failed, all failed:', error);
    }
}

// Solution: Use Promise.allSettled() for partial success
async function testPromiseAllSettled() {
    const results = await Promise.allSettled([
        fetch('/api/user/1'),
        fetch('/api/user/999'),
        fetch('/api/user/3')
    ]);
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            console.log(`User ${index + 1}: Success`);
        } else {
            console.log(`User ${index + 1}: Failed - ${result.reason}`);
        }
    });
}


// Custom promise
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sequentialOperations() {
    console.log('Starting...');
    
    await delay(1000);
    console.log('1 second passed');
    
    await delay(2000);
    console.log('3 seconds total');
    
    return 'All done!';
}

// Usage
sequentialOperations().then(result => console.log(result));



// This is what you'd HAVE to do without async/await:
function fetchUserData(id) {
    return fetch(`/api/users/${id}`)
        .then(response => response.json())
        .then(user => user);
}


// This is equivalent but much more readable:
async function fetchUserData(id) {
    const response = await fetch(`/api/users/${id}`);
    const user = await response.json();
    return user;
}

// Bottom Line:
// async = JavaScript language requirement to use await
// await = Pauses function execution until Promise resolves
// No extra wrapping = async just enables the pause/resume behavior
// Still returns Promise = So other code can await or .then() it
// You MUST use async when you want to use await - it's a JavaScript syntax requirement, not an extra layer of promises!






//////////////// PROMISE runs constructor items immediately ///////////////////////
//////////////// await pauses execution of the function where await is added //////

console.log("1. Before Promise");

const myPromise = new Promise((resolve) => {
    console.log("2. Promise constructor runs immediately");
    setTimeout(() => {
        console.log("5. Inside setTimeout callback");
        resolve("done");
        console.log("6. After resolve call");
    }, 1000);
    console.log("3. After setTimeout setup");
});

myPromise.then((result) => {
    console.log("7. Inside .then():", result);
}).catch((error) => {
    console.log("Inside .catch():", error);
});

console.log("4. Next item - this prints immediately!");

// Output:
// 1. Before Promise
// 2. Promise constructor runs immediately
// 3. After setTimeout setup
// 4. Next item - this prints immediately!
// [1 second later...]
// 5. Inside setTimeout callback
// 6. After resolve call
// 7. Inside .then(): done






async function test() {
    console.log("1. Before await");

    const result = await new Promise((resolve) => {
        console.log("2. Promise constructor runs immediately");
        setTimeout(() => {
            console.log("4. Inside setTimeout callback");
            resolve("done");
            console.log("5. After resolve call");
        }, 1000);
        console.log("3. After setTimeout (but before timeout executes)");
    });

    console.log("6. After await:", result);
}

console.log("0. Before calling test");
test();
console.log("7. After calling test");

// Output:
// 0. Before calling test
// 1. Before await
// 2. Promise constructor runs immediately
// 3. After setTimeout (but before timeout executes)
// 7. After calling test
// [1 second later...]
// 4. Inside setTimeout callback
// 5. After resolve call
// 6. After await: done