import React from 'react';
import TransactionList from '../components/TransactionList';
import Showcase from '@/components/Showcase';
import Hero from '@/components/Hero';
import Links from '@/components/Links';


const AutoSafe: React.FC = () => {

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 ">
      <Hero />
      <Showcase />
      <Links />
      <TransactionList />
    </div>
  );
};

export default AutoSafe;
