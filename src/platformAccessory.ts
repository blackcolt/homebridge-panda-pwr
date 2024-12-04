import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { PandaPwrPlatform } from './platform.js';

export class PandaPwrPlatformAccessory {
  private service: Service;
  private voltageService: Service;
  private batteryService: Service;
  private lastExecutionTime: number;
  private pandaUrl: string;
  private pandaGetStateUrl: string;
  private pandaSetUrl: string;
  private pandaPwrStates = {
    On: false,
    Voltage: 0.0001,
    Power: 0,
  };

  constructor(
      private readonly platform: PandaPwrPlatform,
      private readonly accessory: PlatformAccessory,
  ) {
    this.lastExecutionTime = 0;
    this.pandaUrl = `http://${accessory.context.device.ip}`;
    this.pandaSetUrl = `${this.pandaUrl}/set`;
    this.pandaGetStateUrl = `${this.pandaUrl}/get_state`;

    try {
      setTimeout(async () => {
        const response = await fetch(this.pandaGetStateUrl);
        const json = await response.json();
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Panda')
          .setCharacteristic(this.platform.Characteristic.Model, 'BlackColtPandaPwr')
          .setCharacteristic(this.platform.Characteristic.SerialNumber, json.ap_pwd)
          .setCharacteristic(this.platform.Characteristic.Version, json.fw_version);
      }, 500);
    } catch (e) {
      this.platform.log.warn(e as string);
    }
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'PandaPWR');
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    this.voltageService = this.accessory.getService(this.platform.Service.LightSensor) ||
        this.accessory.addService(this.platform.Service.LightSensor, 'Voltage Sensor');
    this.voltageService.setCharacteristic(this.platform.Characteristic.Name, 'Panda Voltage')
      .setCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, this.pandaPwrStates.Voltage);

    this.batteryService = this.accessory.getService(this.platform.Service.Battery) ||
        this.accessory.addService(this.platform.Service.Battery, 'Battery Sensor');
    this.batteryService.setCharacteristic(this.platform.Characteristic.Name, 'Panda Power Level')
      .setCharacteristic(this.platform.Characteristic.BatteryLevel, this.pandaPwrStates.Power)
      .setCharacteristic(this.platform.Characteristic.ChargingState, this.platform.Characteristic.ChargingState.NOT_CHARGING)
      .setCharacteristic(this.platform.Characteristic.StatusLowBattery,
        this.pandaPwrStates.Power < 1 ?
          this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);

    setInterval(async () => await this.getPandaData(this.accessory), this.accessory.context.device.interval * 1000);
  }

  private async getPandaData(accessory: PlatformAccessory) {
    try {
      this.platform.log.debug('Getting PandaPwr state...');
      const response = await fetch(`http://${accessory.context.device.ip}/update_ele_data`);
      const json = await response.json();
      this.pandaPwrStates.On = json.power !== 0;
      this.service.updateCharacteristic(this.platform.Characteristic.On, this.pandaPwrStates.On);
      this.pandaPwrStates.Voltage = this.normalizeVoltageData(json.voltage || 0);
      this.voltageService.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, this.pandaPwrStates.Voltage);
      this.pandaPwrStates.Power = this.normalizePowerData(json.power);  // Default to 100 if no value
      this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.pandaPwrStates.Power);
      this.batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState,
        this.pandaPwrStates.On ? this.platform.Characteristic.ChargingState.CHARGING : this.platform.Characteristic.ChargingState.NOT_CHARGING);
      this.platform.log.debug('Updated PandaPwr state, power:',
        this.pandaPwrStates.On, 'voltage:', this.pandaPwrStates.Voltage, 'battery level:', this.pandaPwrStates.Power);
    } catch (e) {
      this.platform.log.warn(e as string);
    }
  }

  private normalizeVoltageData = (voltage: number)=>{
    if (voltage > 100) {
      return 100;
    } else if(voltage === 0){
      return 0.0001;
    }
    return voltage;
  };

  private normalizePowerData = (power: number)=> power >= 10 ? 100 : power * 10;

  /**
   * Handle "SET" requests from HomeKit
   */
  async setOn(value: CharacteristicValue) {
    const currentTime = Date.now();
    const timeSinceLastCall = currentTime - this.lastExecutionTime;

    if (timeSinceLastCall < 5000) {
      this.platform.log.warn('Skipping setOn: Less than 5 seconds since the last call.');
      return;
    }

    this.lastExecutionTime = currentTime;
    const state = value as boolean ? 1 : 0;
    this.pandaPwrStates.On = value as boolean;
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.pandaPwrStates.On);
    this.platform.log.debug('Set Characteristic On ->', value);
    await this.sendPowerCommand(state);
  }

  /**
   * Handle "GET" requests from HomeKit
   */
  async getOn(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Characteristic On ->', this.pandaPwrStates.On);
    return this.pandaPwrStates.On;
  }

  /**
   * Function to send power command to Panda device
   */
  private async sendPowerCommand(state: number): Promise<void> {
    try {
      const response = await fetch(this.pandaSetUrl, {
        headers: {
          'cache-control': 'no-cache',
          'content-type': 'text/plain;charset=UTF-8',
          'pragma': 'no-cache',
        },
        body: `power=${state}`,
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        this.pandaPwrStates.On = !this.pandaPwrStates.On;
        this.platform.log.error('Failed to set characteristic', state);
      }
      this.platform.log.debug('Set Characteristic On Succeeded', state);
    } catch (e) {
      this.platform.log.error(e as string);
    }
  }
}
