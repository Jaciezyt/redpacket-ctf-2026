// Virtual File System
const fileSystem = {
  '/': {
    type: 'dir',
    children: {
      'home': {
        type: 'dir',
        children: {
          'guest': {
            type: 'dir',
            children: {
              'readme.txt': { type: 'file', content: 'Welcome to the challenge!\nTry to find the flag hidden in the system.\nAnd send your flag to Telegram bot @jacie_red_packet_bot to verify.\nIf you do not use Telegram, plaease email the flag and social profile(X, QQ, etc..) link to jaciezyt@gmail.com.\nPlease submit your flag by 2026-02-16T04:00:00Z\n\nIs this all?' },
              '.bash_history': { type: 'file', content: 'ls\ncd /var/www\ncat index.html\n# I stored part 1 of the flag in .config/settings.json\nexit' },
              '.config': {
                type: 'dir',
                children: {
                  'settings.json': { type: 'file', content: '{\n  "theme": "dark",\n  "flag_part_1": "flag{fr0n73nd_"\n}' }
                }
              }
            }
          }
        }
      },
      'var': {
        type: 'dir',
        children: {
          'www': {
            type: 'dir',
            children: {
              'html': {
                type: 'dir',
                children: {
                  'index.html': { type: 'file', content: '<html><body>Hello World</body></html>' }
                }
              }
            }
          },
          'log': {
            type: 'dir',
            children: {
              'syslog': { type: 'file', content: 'Feb 16 10:00:01 ctf-box systemd[1]: Started Session 1 of user guest.\nFeb 16 10:05:22 ctf-box sshd[1024]: Failed password for root from 192.168.1.5' }
            }
          }
        }
      },
      'etc': {
        type: 'dir',
        children: {
          'passwd': { type: 'file', content: 'root:x:0:0:root:/root:/bin/bash\nguest:x:1000:1000:guest:/home/guest:/bin/bash' },
          'shadow': { type: 'file', content: 'Permission denied' }
        }
      },
      'root': {
        type: 'dir',
        restricted: true,
        children: {
          'flag.txt': { type: 'file', content: 'Congratulations!\nHere is the rest part of the flag: m4573r_0f_d0m}' }
        }
      }
    }
  }
};

// State
let currentPath = '/home/guest';
let user = 'guest';
const input = document.getElementById('command-input');
const output = document.getElementById('output');
const promptLabel = document.querySelector('.prompt');

// Command History
const commandHistory = [];
let historyIndex = -1;

// Helper: Resolve path to object
function resolvePath(path) {
  if (path === '/') return fileSystem['/'];

  let parts = path.split('/').filter(p => p.length > 0);
  let current = fileSystem['/'];

  for (let part of parts) {
    if (current.children && current.children[part]) {
      current = current.children[part];
    } else {
      return null;
    }
  }
  return current;
}

// Helper: Absolute path builder
function getAbsolutePath(path) {
  if (path.startsWith('/')) return path;
  if (path === '.') return currentPath;
  if (path === '..') {
    let parts = currentPath.split('/').filter(p => p.length > 0);
    parts.pop();
    return '/' + parts.join('/');
  }

  // Handle complex paths like ../etc/passwd
  let currentParts = currentPath === '/' ? [] : currentPath.split('/').filter(p => p.length > 0);
  let newParts = path.split('/');

  for (let part of newParts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (currentParts.length > 0) currentParts.pop();
    } else {
      currentParts.push(part);
    }
  }

  return '/' + currentParts.join('/');
}

// Commands
const commands = {
  help: () => {
    printOutput("Available commands: ls, cd, cat, pwd, clear, whoami, su");
  },

  clear: () => {
    output.innerHTML = '';
  },

  pwd: () => {
    printOutput(currentPath);
  },

  whoami: () => {
    printOutput(user);
  },

  ls: (args) => {
    let targetPath = args[0] ? getAbsolutePath(args[0]) : currentPath;

    // Handle flags like -a
    let showHidden = false;
    if (args[0] && args[0].startsWith('-')) {
      if (args[0].includes('a')) showHidden = true;
      targetPath = args[1] ? getAbsolutePath(args[1]) : currentPath;
    }

    const node = resolvePath(targetPath);

    if (!node) {
      printOutput(`ls: cannot access '${args[0] || ''}': No such file or directory`, 'error');
      return;
    }

    if (node.type !== 'dir') {
      printOutput(targetPath.split('/').pop());
      return;
    }

    // Check restriction
    if (node.restricted && user !== 'root') {
      printOutput(`ls: cannot open directory '${targetPath}': Permission denied`, 'error');
      return;
    }

    const contents = Object.keys(node.children).filter(name => showHidden || !name.startsWith('.')).join('  ');
    printOutput(contents || '(empty)');
  },

  cd: (args) => {
    if (!args[0]) {
      currentPath = '/home/guest';
      updatePrompt();
      return;
    }

    const targetPath = getAbsolutePath(args[0]);
    const node = resolvePath(targetPath);

    if (!node) {
      printOutput(`cd: ${args[0]}: No such file or directory`, 'error');
      return;
    }

    if (node.type !== 'dir') {
      printOutput(`cd: ${args[0]}: Not a directory`, 'error');
      return;
    }

    if (node.restricted && user !== 'root') {
      printOutput(`cd: ${args[0]}: Permission denied`, 'error');
      return;
    }

    currentPath = targetPath;
    updatePrompt();
  },

  cat: (args) => {
    if (!args[0]) {
      printOutput("cat: missing operand", 'error');
      return;
    }

    const targetPath = getAbsolutePath(args[0]);
    const node = resolvePath(targetPath);

    if (!node) {
      printOutput(`cat: ${args[0]}: No such file or directory`, 'error');
      return;
    }

    if (node.type === 'dir') {
      printOutput(`cat: ${args[0]}: Is a directory`, 'error');
      return;
    }

    // Parent directory check for restriction
    let parentPath = targetPath.substring(0, targetPath.lastIndexOf('/')) || '/';
    let parentNode = resolvePath(parentPath);
    if (parentNode && parentNode.restricted && user !== 'root') {
      printOutput(`cat: ${args[0]}: Permission denied`, 'error');
      return;
    }

    printOutput(node.content);
  },

  su: (args) => {
    if (!args[0]) {
      printOutput("usage: su <username>");
      return;
    }

    if (args[0] === 'root') {
      // Simple password prompt simulation (synchronous for simplicity in this pure frontend version)
      // In a real terminal, we'd change input mode to password
      // Here we'll just implement a 'sudo' style command or check a second argument for simplicity
      if (args[1] === 'w3b_sh3ll_r00t_4cc3ss') {
        user = 'root';
        printOutput("Logged in as root.");
        updatePrompt();
      } else {
        printOutput("su: Authentication failure", 'error');
      }
    } else if (args[0] === 'guest') {
      user = 'guest';
      printOutput("Logged in as guest.");
      updatePrompt();
    } else {
      printOutput(`su: User ${args[0]} does not exist`, 'error');
    }
  }
};

// UI Logic
function printOutput(text, type = '') {
  const div = document.createElement('div');
  div.className = `line ${type}`;
  div.textContent = text;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

function updatePrompt() {
  promptLabel.textContent = `${user}@ctf:${currentPath === '/home/guest' ? '~' : currentPath}$`;
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      input.value = commandHistory[commandHistory.length - 1 - historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = commandHistory[commandHistory.length - 1 - historyIndex];
    } else {
      historyIndex = -1;
      input.value = '';
    }
  } else if (e.key === 'Enter') {
    const commandLine = input.value.trim();
    if (commandLine) {
      // Add to history if not empty and not same as last command
      if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== commandLine) {
        commandHistory.push(commandLine);
      }
      historyIndex = -1;

      // Echo command
      printOutput(`${promptLabel.textContent} ${commandLine}`);

      // Parse command
      const parts = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const cmd = parts[0];
      const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));

      if (commands[cmd]) {
        commands[cmd](args);
      } else {
        printOutput(`${cmd}: command not found`, 'error');
      }
    } else {
      printOutput(promptLabel.textContent);
    }
    input.value = '';
  }
});

// Initial focus and click handling
document.body.addEventListener('click', (e) => {
  // Don't steal focus if user is selecting text
  if (window.getSelection().toString().length > 0) {
    return;
  }
  // Don't steal focus if clicking on input itself (let default behavior handle cursor placement)
  if (e.target === input) {
    return;
  }
  input.focus();
});
