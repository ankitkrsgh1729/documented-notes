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