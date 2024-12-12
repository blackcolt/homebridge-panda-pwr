export const normalizePowerData = (power:number) => power >= 10 ? 100 : power * 10;

export const normalizeVoltageData = (voltage: number)=>{
  if (voltage > 100) {
    return 100;
  } else if(voltage === 0){
    return 0.0001;
  }
  return voltage;
};


