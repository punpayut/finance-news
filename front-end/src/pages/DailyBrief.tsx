import React from 'react';

const DailyBrief: React.FC = () => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Daily Brief</h1>
        
        <div className="text-lg text-gray-600 mb-6">
          <p className="font-semibold">{currentDate}</p>
          <p>{currentTime}</p>
        </div>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Weather</h2>
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-gray-700">Location: Your City</p>
            <p className="text-gray-700">Temperature: 25°C (77°F)</p>
            <p className="text-gray-700">Condition: Sunny</p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Top News Headlines</h2>
          <ul className="list-disc list-inside text-gray-700">
            <li className="mb-2">Global markets show mixed reactions to new economic policies.</li>
            <li className="mb-2">Tech innovation drives growth in the renewable energy sector.</li>
            <li className="mb-2">Local community initiatives aim to boost small businesses.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">Upcoming Events</h2>
          <ul className="list-disc list-inside text-gray-700">
            <li className="mb-2">Team Meeting - 10:00 AM (Virtual)</li>
            <li className="mb-2">Project Deadline - End of Day</li>
            <li className="mb-2">Community Workshop - 3:00 PM (Park Pavilion)</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default DailyBrief;
