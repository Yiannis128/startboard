import { ThemeWidget } from './ThemeWidget.js';
import { WelcomeTextWidget } from './WelcomeTextWidget.js';
import { TimeWidget } from './TimeWidget.js';
import { SearchWidget } from './SearchWidget.js';
import { ShortcutsWidget } from './ShortcutsWidget.js';
import { BackdropWidget } from './BackdropWidget.js';

/**
 * The widget registry - the one place a widget has to be listed.
 *
 * Order controls both the sidebar and the page: each widget gets a settings
 * section and a page container in this order. To add one, write a class
 * extending Widget (see src/core/Widget.js) and add it here.
 */
export const WIDGETS = [
  ThemeWidget,
  WelcomeTextWidget,
  TimeWidget,
  SearchWidget,
  ShortcutsWidget,
  BackdropWidget,
];
