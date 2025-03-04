import React, { ChangeEvent } from 'react';

const LeftNavBar: React.FC = () => {
  const handleProgrammeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newProgramme = e.target.value;
    onSettingsChange({ ...settings, programme: newProgramme });
    
    // Clear programme dates if not selecting a regular programme item
    if (newProgramme === "" || newProgramme === "Link to Fee Proposal") {
      setProgrammeDates({});
    }
  };

  return (
    // Rest of the component code
  );
};

export default LeftNavBar; 