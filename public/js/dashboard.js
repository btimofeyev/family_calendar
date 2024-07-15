const user = {
    name: "John Doe",
    email: "john@example.com",
    avatarUrl: "/api/placeholder/32/32"
};

const posts = [
    { author: "Jane Doe", content: "Just finished baking cookies!" },
    { author: "Jimmy Doe", content: "Got an A on my math test!" },
    { author: "John Doe", content: "Family movie night tonight!" }
];

const members = [
    { name: "John Doe", avatarUrl: "/api/placeholder/32/32" },
    { name: "Jane Doe", avatarUrl: "/api/placeholder/32/32" },
    { name: "Jimmy Doe", avatarUrl: "/api/placeholder/32/32" }
];

// User Profile
document.getElementById('userAvatar').textContent = user.name.charAt(0);
document.getElementById('userName').textContent = user.name;
document.getElementById('userEmail').textContent = user.email;

// Family Calendar
const calendarGrid = document.getElementById('calendarGrid');
for (let i = 1; i <= 31; i++) {
    const day = document.createElement('div');
    day.className = 'calendar-day';
    day.textContent = i;
    calendarGrid.appendChild(day);
}

// Family Social Feed
const socialFeedContent = document.getElementById('socialFeedContent');
posts.forEach(post => {
    const postElement = document.createElement('div');
    postElement.className = 'social-post';
    postElement.innerHTML = `<strong>${post.author}</strong>: ${post.content}`;
    socialFeedContent.appendChild(postElement);
});

// Member List
const memberListContent = document.getElementById('memberListContent');
members.forEach(member => {
    const memberItem = document.createElement('li');
    memberItem.className = 'member-item';
    memberItem.innerHTML = `
        <div class="avatar">${member.name.charAt(0)}</div>
        <span>${member.name}</span>
    `;
    memberListContent.appendChild(memberItem);
});