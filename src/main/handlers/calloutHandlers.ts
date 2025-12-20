import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import { getContainer } from '../core/container';
import { hideCalloutWindow } from '../windows/calloutWindow';

export function registerCalloutHandlers(_calloutWindow: BrowserWindow): void {
  const { calloutRepo } = getContainer();

  ipcMain.handle(IPC_CHANNELS.CALLOUT_DISMISS, (_, id: string) => {
    hideCalloutWindow();
    return calloutRepo.dismiss(id);
  });
}
