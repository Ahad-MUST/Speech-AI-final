import React from 'react';

const PageHeader = () => {

  return (
    <>
      {/* Main Title Section - No Add New Button */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <span className="text-psycon-mint  font-bold text-2xl mr-2">Exploration &</span>
          <span className="text-psycon-yellow font-bold text-2xl">Interviews</span>
        </div>
        <h1 className="text-4xl font-light text-gray-900 mb-2">
          <span className="text-psycon-mint">"</span>
          <span className='font-semibold'> Turn Spoken Thoughts Into Smart Actions </span>
          <span className="text-psycon-mint">"</span>
        </h1>
      </div>
    </>
  );

};

export default PageHeader;