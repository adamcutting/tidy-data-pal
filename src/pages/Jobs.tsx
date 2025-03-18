
import React from 'react';
import JobsManagerFixed from '@/components/JobsManagerFixed';

const Jobs = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold mb-6">Active Deduplication Jobs</h1>
        <JobsManagerFixed />
      </main>
    </div>
  );
};

export default Jobs;
