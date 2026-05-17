import type { BeamParams } from './kl/types';
import type { MemberType } from '../config';

export interface ProjectFile {
  version: 1;
  name: string;
  memberType: MemberType;
  createdAt: string;
  params: BeamParams;
}

export function exportProject(name: string, params: BeamParams): void {
  const project: ProjectFile = {
    version: 1,
    name,
    memberType: 'KL',
    createdAt: new Date().toISOString(),
    params,
  };
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.rebar.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseProjectFile(text: string): ProjectFile {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !data.params) {
    throw new Error('无效的项目文件格式');
  }
  return data as ProjectFile;
}

export function importProjectFromFile(): Promise<ProjectFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.rebar.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('未选择文件'));
      try {
        const text = await file.text();
        resolve(parseProjectFile(text));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
