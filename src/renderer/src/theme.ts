try {
        const theme = localStorage.getItem('dsh_desktop_theme');
        if (theme === 'light') {
          document.documentElement.classList.add('light');
        } else if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
