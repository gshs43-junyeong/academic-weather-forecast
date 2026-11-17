import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/home.css';
import './styles/timeline.css';
import './styles/register.css';
import { createStore } from './ui/store';
import { mountShell } from './ui/shell';

const root = document.getElementById('app')!;
const store = createStore();
mountShell(root, store);
