// Create this file and run it in your browser console
const mockSession = { user: { id: 'mock-user-id', email: 'your.email@example.com' } };
const mockProfile = { user_id: 'mock-user-id', first_name: 'Your', last_name: 'Name' };
localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: mockSession }));
console.log('Mock auth data set!');
