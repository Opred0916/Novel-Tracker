import type { Tag } from './types';

const GROUPS = [
  { title: '背景与世界', names: ['古代', '现代', '都市', '星际', '架空', '西幻', '玄幻', '仙侠', '校园', '职场', '娱乐圈', '豪门', '末世'] },
  { title: '情节与设定', names: ['悬疑', '无限流', '穿越', '重生', '系统', '快穿', '种田', '哨向', '兽人', '复仇', '权谋', '救赎', 'ABO'] },
  { title: '人物与关系', names: ['群像', '强强', '年上', '年下', '竹马竹马', '欢喜冤家', '先婚后爱', '双向暗恋', '追妻火葬场', '替身', '白月光', '宿敌', '万人迷', '大女主', '主攻', '主受', '破镜重圆', '美强惨'] },
  { title: '阅读氛围', names: ['慢热', '轻松', '治愈', '甜', '虐', '酸涩', '日常向', '交通发达', '荤素搭配', '清水'] },
  { title: '结局与篇幅', names: ['HE', 'BE', 'OE', '短篇', '长篇'] },
  { title: '叙事视角', names: ['第一人称', '第二人称'] },
] as const;

export function groupTags(tags: Tag[]): { title: string; tags: Tag[] }[] {
  const byName = new Map<string, string>(GROUPS.flatMap(group => group.names.map(name => [name, group.title] as const)));
  const grouped = new Map<string, Tag[]>();
  for (const tag of tags) {
    const title = tag.isSystem ? byName.get(tag.name) ?? '其他预设' : '我的标签';
    grouped.set(title, [...(grouped.get(title) ?? []), tag]);
  }
  return [...GROUPS.map(group => group.title), '其他预设', '我的标签']
    .filter(title => grouped.has(title))
    .map(title => ({ title, tags: grouped.get(title)! }));
}
