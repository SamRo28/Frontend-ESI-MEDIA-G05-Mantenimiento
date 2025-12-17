import { ChangeDetectorRef, Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AppUser, UserDto, Contenido } from '../auth/models';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ContenidosService, ResolveResult } from '../contenidos.service';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { firstValueFrom, Observable, forkJoin, of } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { FavoritesService } from '../favorites.service';
import { environment } from '../environments/environment';
import { ContentDetailsModalComponent } from '../modals/content-details-modal/content-details-modal.component';
import { EditProfileModalComponent } from '../modals/edit-profile-modal/edit-profile-modal.component';
import { AvatarSelectorModalComponent } from '../modals/avatar-selector-modal/avatar-selector-modal.component';
import { MediaPlayerModalComponent } from '../modals/media-player-modal/media-player-modal.component';
import { CreateListModalComponent } from '../modals/create-list-modal/create-list-modal.component';
import { MobileNavbarComponent } from '../mobile-navbar/mobile-navbar.component';
import { ListasPublicasService, ListaPublica } from '../listas-publicas.service';
import { AlertsModalComponent } from '../modals/alerts-modal/alerts-modal.component';
import { AlertasService, UserAlert } from '../alertas.service';
import { TAGS_ALL, TAGS_AUDIO, TAGS_VIDEO } from '../tags.constants';

type RolContenidoFiltro = '' | 'VIP' | 'STANDARD';
type OrdenContenido = 'fecha' | 'titulo' | 'reproducciones';
type Direccion = 'asc' | 'desc';
type AgeMode = '' | 'mayores' | 'menores';

function ytIdFrom(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/').filter(Boolean)[1];
      return id || null;
    }
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    return null;
  } catch { return null; }
}
function toYouTubeEmbed(url: string): string | null {
  const id = ytIdFrom(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}
function vimeoIdFrom(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const ix = parts.indexOf('video');
      const id = ix >= 0 ? parts[ix + 1] : parts[0];
      return id && /^\d+$/.test(id) ? id : null;
    }
    return null;
  } catch { return null; }
}
function toVimeoEmbed(url: string): string | null {
  const id = vimeoIdFrom(url);
  if (!id) return null;
  return `https://player.vimeo.com/video/${id}?autoplay=1`;
}
function isDirectMedia(url: string): boolean {
  const l = url.toLowerCase();
  return l.endsWith('.mp4') || l.endsWith('.webm') || l.endsWith('.ogg') || l.endsWith('.m3u8');
}

@Component({
  selector: 'app-pagina-inicial-usuario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StarRatingComponent,
    ContentDetailsModalComponent,
    EditProfileModalComponent,
    AvatarSelectorModalComponent,
    MediaPlayerModalComponent,
    CreateListModalComponent,
    MobileNavbarComponent,
    AlertsModalComponent
  ],
  templateUrl: './pagina-inicial-usuario.html',
  styleUrls: ['./pagina-inicial-usuario.css'],
})
export class PaginaInicialUsuario implements OnInit {
  readOnly = false;
  fromAdmin = false;

  contenidos: Contenido[] = [];
  filteredCon: Contenido[] = [];
  listasPublicas: ListaPublica[] = [];

  misListas: ListaPublica[] = [];
  nuevaListaNombre = '';
  nuevaListaDescripcion = '';
  nuevaListaPublica = false;
  creatingList = false;
  crearListaError: string | null = null;
  crearListaOk: string | null = null;
  showCrearListaModal = false;

  showFilters = false;
  toggleFilters() {
    if (this.editOpen) return;
    this.showFilters = !this.showFilters;
    this.cdr.markForCheck();
  }
  closeFilters() {
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  // Alertas
  alertas: UserAlert[] = [];
  alertasLoading = false;
  alertasError: string | null = null;
  showAlertas = false;
  get alertCount(): number { return this.alertas?.length || 0; }

  pageSize = 12;
  page = 1;
  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredCon.length / this.pageSize)); }
  get pagedCon(): Contenido[] { const start = (this.page - 1) * this.pageSize; return this.filteredCon.slice(start, start + this.pageSize); }
  goPage(p: number) { this.page = Math.min(this.totalPages, Math.max(1, p)); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { } }
  nextPage() { this.goPage(this.page + 1); }
  prevPage() { this.goPage(this.page - 1); }

  private catalogBackup: Contenido[] | null = null;
  contenidosLoading = false;
  contenidosError: string | null = null;


  filtrosContenido = {
    q: '',
    tipo: '',
    categoria: '',
    role: '' as '' | 'VIP' | 'STANDARD',
    ageMode: '' as '' | 'mayores' | 'menores',
    ageValue: null as number | null,
    resolucion: '',
    ordenar: 'fecha' as 'fecha' | 'titulo' | 'reproducciones',
    dir: 'desc' as 'asc' | 'desc',
    listaId: '',
  };
  tiposDisponibles: string[] = [];
  categoriasDisponibles: string[] = [];
  resolucionesDisponibles: string[] = [];
  onFiltrosChange(): void { this.applyFilter(); this.cdr.markForCheck(); }
  resetFiltros(): void {
    this.filtrosContenido = { q: '', tipo: '', categoria: '', role: '', ageMode: '', ageValue: null, resolucion: '', ordenar: 'fecha', dir: 'desc', listaId: '' };
    this.applyFilter();
  }

  private readonly CONTENIDOS_BASE = `${environment.API_BASE}/Contenidos`;
  private readonly LISTAS_BASE = `${environment.API_BASE}/listas`;

  private favIds = new Set<string>();
  favsLoaded = false;
  pendingToggle: Record<string, boolean> = {};
  private onlyFavsView = false;

  // History
  private historyIds = new Set<string>();
  historyLoaded = false;

  playerOpen = false;
  playerSrc: string | null = null;
  playerKind: 'AUDIO' | 'VIDEO' | 'EMBED' = 'VIDEO';
  embedUrl: SafeResourceUrl | null = null;
  selectedListaPorContenido: Record<string, string> = {};
  creandoListaContenido: Record<string, boolean> = {};
  msgListaOk: Record<string, string> = {};
  msgListaError: Record<string, string> = {};


  @ViewChild('videoEl') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('audioEl') audioRef?: ElementRef<HTMLAudioElement>;
  iframeKey = 0;

  playingId: string | null = null;
  playingTitle: string | null = null;

  avatars: string[] = [
    'assets/avatars/avatar1.png', 'assets/avatars/avatar2.png', 'assets/avatars/avatar3.png',
    'assets/avatars/avatar4.png', 'assets/avatars/avatar5.png', 'assets/avatars/avatar6.png'
  ];
  foto: string | null = null;
  selectedAvatar: string | null = null;
  showAvatarModal = false;


  userName = '';
  userEmail = '';
  userInitials = '';
  userAvatar: string | null = null;
  userVip: boolean = false;

  private loggedUser: UserDto | null = null;
  private userAliasActual = '';

  loading = false;
  errorMsg = '';
  okMsg: string | null = null;
  saving = false;
  editOpen = false;
  aliasError: string | null = null;
  aliasChecking = false;
  aliasTaken = false;

  gustosDisponibles: string[] = [];
  gustosSeleccionados: string[] = [];

  model: Partial<{ nombre: string; apellidos: string; alias: string; fechaNac: string; foto: string; vip: boolean; misGustos: string[] }> = {};
  private readonly MAX = { nombre: 100, apellidos: 100, alias: 12 };
  private readonly ALIAS_MIN = 3;

  private t = (s: unknown) => (typeof s === 'string' ? s : '').trim();
  private normUrl(raw: unknown): string {
    const s = this.t(raw);
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('assets/')) return s;
    const API_BASE: string | null = null;
    return API_BASE ? s.replace(/^\/+/g, '') : s;
  }
  launchingId: string | null = null;

  private startLaunch(id: string) {
    this.launchingId = id;
    setTimeout(() => { if (this.launchingId === id) this.launchingId = null; }, 1200);
  }

  private cleanPayload<T extends Record<string, any>>(obj: T): T {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      if (v === undefined) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      out[k] = v;
    }
    return out as T;
  }
  private initialsFrom(text: string): string {
    const s = this.t(text);
    if (!s) return 'U';
    return s.split(/\s+/, 2).map(p => (p[0]?.toUpperCase() ?? '')).join('') || 'U';
  }
  private formatISODate(raw?: string | null): string {
    const s = this.t(raw);
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return s.slice(0, 10);
  }

  // --- Taste Tags Helpers ---
  private canonicalizeTags(tags: string[]): string[] {
    return Array.from(new Set(tags.map(t => this.normalizeTasteTag(t)).filter(Boolean)));
  }
  private normalizeTasteTag(t: string): string {
    return (t || '').trim();
  }
  private loadGustosLocal(): string[] {
    try {
      const raw = localStorage.getItem(`user_gustos_${this.userEmail}`);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch { return []; }
  }
  private persistGustosLocal() {
    if (!this.userEmail) return;
    localStorage.setItem(`user_gustos_${this.userEmail}`, JSON.stringify(this.gustosSeleccionados));
  }
  private syncGustosBackendIfMissing(fromBackend: string[], fromCache: string[]) {
    // Si backend viene vacío, pero tengo local => enviar local al backend
    // Esto es "auto-reparación" silenciosa.
    if (fromBackend.length === 0 && fromCache.length > 0 && !this.readOnly) {
      this.gustosSeleccionados = fromCache;
      // Podríamos disparar guardarCambios(), pero es arriesgado hacerlo automático sin pedir confirmación.
      // Mejor lo dejamos en UI. Si el usuario abre perfil, verá sus gustos locales. Al guardar, se suben.
    }
  }
  private syncGustosDisponibles() {
    this.gustosDisponibles = TAGS_ALL.slice();
    // Podríamos filtrar solo AUDIO/VIDEO según tiposDisponibles, 
    // pero TAGS_ALL ya cubre todo.
  }

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly s: DomSanitizer,
    private contenidosSvc: ContenidosService,
    private favs: FavoritesService,
    private listasService: ListasPublicasService,
    private alertasSvc: AlertasService
  ) { }

  private readonly DEFAULT_TIPOS = ['AUDIO', 'VIDEO'];
  private readonly DEFAULT_CATEGORIAS = ['Acción', 'Comedia', 'Drama', 'Suspenso', 'Animación', 'Ciencia Ficción', 'Terror', 'Documental', 'Romance', 'Aventura'];
  private readonly DEFAULT_RESOLUCIONES = ['480p', '720p', '1080p', '4K'];

  get isUsuario(): boolean {
    const role = (this.loggedUser?.role ?? '').toString().toUpperCase();
    if (!role) return true;
    return role === 'USUARIO';
  }

  ngOnInit(): void {
    this.computeReadOnlyFlags();
    this.bootstrapUser();
    this.cargarContenidos();
    this.cargarListasPublicas();
    this.syncGustosDisponibles();
  }

  cargarListasPublicas() {
    this.listasService.listarListas().subscribe({
      next: (listas) => {
        this.listasPublicas = listas || [];
        // Filter my lists (assuming userEmail matches)
        if (this.userEmail) {
          this.misListas = this.listasPublicas.filter(l => l.userEmail === this.userEmail || l.emailUsuario === this.userEmail);
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error cargando listas', err)
    });
  }

  openCrearListaModal() {
    this.showCrearListaModal = true;
    this.crearListaError = null;
    this.crearListaOk = null;
    this.nuevaListaNombre = '';
    this.nuevaListaDescripcion = '';
    this.cdr.markForCheck();
  }

  closeCrearListaModal() {
    this.showCrearListaModal = false;
    this.cdr.markForCheck();
  }

  crearLista() {
    if (!this.nuevaListaNombre.trim()) {
      this.crearListaError = 'El nombre es obligatorio';
      return;
    }
    this.creatingList = true;
    this.crearListaError = null;

    const nueva = {
      nombre: this.nuevaListaNombre,
      descripcion: this.nuevaListaDescripcion,
      userEmail: this.userEmail,
      contenidosIds: [],
      publica: this.nuevaListaPublica
    };

    this.listasService.crearLista(nueva).subscribe({
      next: (res) => {
        this.creatingList = false;
        this.crearListaOk = 'Lista creada correctamente';
        this.cargarListasPublicas();
        setTimeout(() => this.closeCrearListaModal(), 1500);
      },
      error: (err) => {
        this.creatingList = false;
        this.crearListaError = err?.error?.message || 'Error al crear la lista';
        this.cdr.markForCheck();
      }
    });
  }

  anadirContenidoALista(contenido: Contenido, listaId: string) {
    if (!listaId || !contenido?.id) return;

    this.creandoListaContenido[contenido.id] = true;
    this.msgListaOk[contenido.id] = '';
    this.msgListaError[contenido.id] = '';
    this.cdr.markForCheck();

    this.listasService.añadirContenido(listaId, contenido.id).subscribe({
      next: () => {
        this.creandoListaContenido[contenido.id] = false;
        this.msgListaOk[contenido.id] = 'Añadido correctamente';
        setTimeout(() => {
          this.msgListaOk[contenido.id] = '';
          this.cdr.markForCheck();
        }, 3000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creandoListaContenido[contenido.id] = false;
        this.msgListaError[contenido.id] = 'Error al añadir';
        this.cdr.markForCheck();
      }
    });
  }

  onAliasChange(alias: string) {
    if (!this.model) this.model = {};
    this.model.alias = alias;
  }

  // Métodos de alertas
  cargarAlertas(): void {
    if (!this.userEmail) return;
    this.alertasLoading = true;
    this.alertasError = null;
    this.alertasSvc.listar(this.userEmail).subscribe({
      next: (arr) => {
        this.alertas = arr || [];
        this.alertasLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.alertasLoading = false;
        this.alertasError = e?.error?.message || e?.message || 'No se pudieron cargar las alertas';
        this.cdr.markForCheck();
      }
    });
  }

  toggleAlertasPanel(): void {
    this.showAlertas = !this.showAlertas;
    if (this.showAlertas) {
      this.cargarAlertas();
    }
    this.cdr.markForCheck();
  }

  closeAlertasPanel(): void {
    this.showAlertas = false;
    this.cdr.markForCheck();
  }

  onAlertDeleted(alertId: string): void {
    this.alertas = this.alertas.filter(a => a.id !== alertId);
    this.cdr.markForCheck();
  }

  onReloadAlertas(): void {
    this.cargarAlertas();
  }


  private apiListFavIds(): Observable<string[]> { return this.favs.loadFavoritosIds(); }
  private apiAddFav(id: string): Observable<any> { return this.favs.addFavorito(id); }
  private apiRemoveFav(id: string): Observable<any> { return this.favs.removeFavorito(id); }
  private setFavIds(ids: string[] | null | undefined) {
    this.favIds = new Set((ids ?? []).filter(Boolean));
    this.favsLoaded = true;
    if (this.filterMode === 'favoritos') this.applyFilter();
    this.cdr.markForCheck();
  }
  loadFavoritos(): void {
    this.apiListFavIds().subscribe({
      next: (ids) => this.setFavIds(ids),
      error: () => { this.setFavIds([]); }
    });
  }
  isFav(id: string | null | undefined): boolean { return !!id && this.favIds.has(id); }
  async onToggleFav(id: string | null | undefined) {
    if (!id || this.readOnly) return;
    if (this.pendingToggle[id]) return;
    this.pendingToggle[id] = true;
    const currentlyFav = this.isFav(id);
    if (currentlyFav) this.favIds.delete(id); else this.favIds.add(id);
    this.cdr.markForCheck();
    try { currentlyFav ? await firstValueFrom(this.apiRemoveFav(id)) : await firstValueFrom(this.apiAddFav(id)); }
    catch (e: any) {
      if (currentlyFav) this.favIds.add(id); else this.favIds.delete(id);
      const msg = e?.error?.message || e?.message || 'No se pudo actualizar favoritos';
      Swal.fire({ icon: 'error', title: 'Favoritos', text: msg });
    } finally {
      this.pendingToggle[id] = false;
      this.cdr.markForCheck();
    }
  }


  loadHistory(): void {
    if (!this.userEmail) return;
    try {
      const key = `user_history_${this.userEmail}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.historyIds = new Set(arr);
        }
      }
    } catch (e) {
      console.error('Error loading history', e);
    }
    this.historyLoaded = true;
    this.cdr.markForCheck();
  }

  pushToHistory(c: Contenido): void {
    if (!this.userEmail || !c?.id) return;
    try {
      const key = `user_history_${this.userEmail}`;
      let arr: string[] = [];
      const raw = localStorage.getItem(key);
      if (raw) arr = JSON.parse(raw);

      // Remove to avoid dupes, add to front
      arr = arr.filter(x => x !== c.id);
      arr.unshift(c.id);

      // Limit size
      if (arr.length > 50) arr = arr.slice(0, 50);

      localStorage.setItem(key, JSON.stringify(arr));
      this.historyIds = new Set(arr);
      this.cdr.markForCheck();
    } catch (e) { console.error('Error pushing history', e); }
  }

  private computeReadOnlyFlags(): void {
    const qp = this.route.snapshot.queryParamMap;
    const qModo = (qp.get('modoLectura') || '').toLowerCase();
    const qFrom = (qp.get('from') || '').toLowerCase();
    const stateFrom = history.state?.fromAdmin === true;
    const lsReadOnly = localStorage.getItem('users_readonly_mode') === '1';
    const lsFromAdmin = localStorage.getItem('users_readonly_from_admin') === '1';
    this.readOnly =
      ['1', 'true', 'si', 'yes'].includes(qModo) ||
      (lsReadOnly && lsFromAdmin) ||
      location.pathname.includes('/usuarioReadOnly');
    this.fromAdmin = qFrom === 'admin' || stateFrom || lsFromAdmin;
    if (this.readOnly && this.fromAdmin) {
      localStorage.setItem('users_readonly_mode', '1');
      localStorage.setItem('users_readonly_from_admin', '1');
    }
  }
  private bootstrapUser(): void {
    const stateUser = (history.state?.user ?? null) as UserDto | null;
    const sessionUser = this.auth.getCurrentUser?.() ?? this.getUserFromLocalStorage();
    this.setLoggedUser(stateUser ?? sessionUser ?? null);
  }
  private getUserFromLocalStorage(): UserDto | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserDto>;
      return parsed?.email && parsed?.role ? (parsed as UserDto) : null;
    } catch { return null; }
  }
  private setLoggedUser(user: UserDto | null) {
    this.loggedUser = user;
    if (!user) return;
    this.userName = this.t(user.nombre) || user.email.split('@')[0];
    this.userEmail = user.email;
    if (!this.favsLoaded) this.loadFavoritos();
    this.auth.getPerfil(this.userEmail).subscribe({
      next: (u: any) => this.onPerfilLoaded(u),
      error: (_e: HttpErrorResponse) => { this.errorMsg = 'No se pudo cargar tu perfil'; this.cdr.markForCheck(); }
    });
  }
  private onPerfilLoaded(u: any) {
    this.paintFromProfile(u);
    const avatar = this.normUrl(this.resolveAvatarRaw(u));
    this.userAvatar = avatar || null;
    if (!avatar) this.userInitials = this.initialsFrom(u?.alias || u?.nombre || this.userName);
    this.applyFilter();
    this.cargarListasPublicas();
    this.cdr.markForCheck();
  }
  private resolveAvatarRaw(u: any): string { return this.t(u?.fotoUrl) || this.t(u?.foto) || this.t(this.model?.foto); }
  private paintFromProfile(u: any) {
    this.userEmail = u?.email ?? this.userEmail;
    this.userAliasActual = this.t(u?.alias);
    const nombre = this.t(u?.nombre);
    const apellidos = this.t(u?.apellidos);
    const fullName = `${nombre} ${apellidos}`.trim();
    this.userName = this.t(u?.alias) || fullName || u?.email || this.userName;
    this.userInitials = this.initialsFrom(this.t(u?.alias) || fullName || u?.email || '');

    // Gustos
    const gustosRaw = Array.isArray(u?.misGustos)
      ? u.misGustos
      : typeof u?.misGustos === 'string'
        ? u.misGustos.split(',').map((x: string) => x.trim()).filter(Boolean)
        : [];
    const gustosFromBackend = this.canonicalizeTags(Array.isArray(gustosRaw) ? gustosRaw : []);
    const gustosFromCache = this.canonicalizeTags(this.loadGustosLocal());
    const gustosFinal = gustosFromBackend.length > 0 ? gustosFromBackend : gustosFromCache;

    this.model = {
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      alias: u?.alias ?? '',
      fechaNac: this.formatISODate(u?.fechaNac),
      foto: u?.foto ?? u?.fotoUrl ?? '',
      vip: !!u?.vip,
      misGustos: gustosFinal
    };
    this.gustosSeleccionados = gustosFinal
      .map((g: string) => this.normalizeTag(g))
      .filter(Boolean);
    this.persistGustosLocal();
    this.syncGustosBackendIfMissing(gustosFromBackend, gustosFromCache);
  }
  salirModoLectura(): void { localStorage.removeItem('users_readonly_mode'); localStorage.removeItem('users_readonly_from_admin'); this.router.navigateByUrl('/admin'); }
  CerrarSesion(): void {
    Swal.fire({ title: '¿Seguro que deseas cerrar sesión?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, cerrar sesión', cancelButtonText: 'Cancelar', reverseButtons: true })
      .then(r => {
        if (!r.isConfirmed) return;
        this.auth.logout?.(); localStorage.removeItem('user');
        Swal.fire({ title: 'Sesión cerrada correctamente.', icon: 'success', timer: 1500, showConfirmButton: false, willClose: () => { void this.router.navigateByUrl('/auth/login', { replaceUrl: true }); } });
      });
  }
  DarDeBaja(): void {
    if (!confirm('¿Seguro que deseas darte de baja de la plataforma? Esta acción no se puede deshacer.')) return;
    this.auth.darseBaja(this.userEmail).subscribe({
      next: (msg: string) => {
        alert(msg || 'Usuario eliminado correctamente');
        this.auth.logout?.();
        localStorage.removeItem('user');
        sessionStorage.clear();
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      },
      error: (err: any) => alert(err?.error || err?.message || 'Error al eliminar usuario')
    });
  }
  openAvatarModal() { this.showAvatarModal = true; }
  closeAvatarModal() { this.showAvatarModal = false; }
  selectAvatar(a: string) { this.selectedAvatar = a; this.foto = a; this.closeAvatarModal(); }
  onProfileClicked() {
    Swal.fire({
      title: 'Opciones de perfil',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Editar Perfil',
      denyButtonText: 'Cerrar Sesión',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      denyButtonColor: '#d33',
    }).then((result) => {
      if (result.isConfirmed) {
        this.toggleEditar();
      } else if (result.isDenied) {
        this.CerrarSesion();
      }
    });
  }

  onViewChange(view: string) {
    if (this.editOpen) {
      this.editOpen = false;
      this.cdr.markForCheck();
    }
    if (view === 'inicio') view = 'todos';

    // Cast to literal type to satisfy TS if needed, logic remains valid
    const validModes = ['todos', 'favoritos', 'historial'];
    if (validModes.includes(view)) {
      this.filterMode = view as 'todos' | 'favoritos' | 'historial';
      this.onFilterChange();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.cdr.detectChanges(); // Force update
    }
  }

  toggleEditar() { if (this.readOnly) return; requestAnimationFrame(() => { this.editOpen = !this.editOpen; this.cdr.markForCheck(); }); }
  toggleCrearListaPanel(): void {
    if (this.readOnly) return;
    this.showCrearListaModal = !this.showCrearListaModal;
    this.crearListaError = null;
    this.crearListaOk = null;
  }

  cancelarEditar() { this.editOpen = false; this.cdr.markForCheck(); }
  handleKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') this.closeAvatarModal(); }
  async guardarCambios() {
    if (this.readOnly) return;
    if (this.aliasChecking) {
      return this.failSave('Espera a que termine la comprobación del alias.');
    }
    if (this.aliasTaken) {
      return this.failSave('El alias ya existe. Elige otro.');
    }
    const msg = this.validateProfileFields();
    if (msg) return this.failSave(msg);
    this.okMsg = null; this.errorMsg = ''; this.saving = true;
    try {
      const aliasAEnviar = await this.computeAliasToSend();
      const fotoSeleccionada = this.computeFotoToSend();
      const raw: Partial<AppUser> & { foto?: string; fotoUrl?: string } = {
        email: this.userEmail, alias: aliasAEnviar, nombre: this.t(this.model?.nombre) || undefined, apellidos: this.t(this.model?.apellidos) || undefined,
        fechaNac: this.model?.fechaNac ? String(this.model.fechaNac).slice(0, 10) : undefined,
        vip: typeof this.model?.vip === 'boolean' ? this.model.vip : undefined,
        fotoUrl: fotoSeleccionada, foto: fotoSeleccionada,
        misGustos: this.model.misGustos // Se actualiza via modal
      };
      const payload = this.cleanPayload(raw);
      this.auth.putPerfil(payload).subscribe({
        next: (perfil: any) => this.successSave(perfil),
        error: (err: any) => this.failSave(err?.error?.message || err?.message || 'Error al actualizar el perfil')
      });
    } catch (e: any) { this.failSave(e?.message || 'Error al procesar los cambios'); }
  }
  private successSave(perfil: any) {
    this.paintFromProfile(perfil);
    this.editOpen = false; this.okMsg = 'Se ha editado correctamente'; this.errorMsg = ''; this.saving = false;
    if (this.selectedAvatar) this.userAvatar = this.selectedAvatar;
    this.gustosSeleccionados = this.model.misGustos || [];
    this.persistGustosLocal();
    this.cargarContenidos();
    void Swal.fire({ icon: 'success', title: 'Se ha editado correctamente', timer: 1500, showConfirmButton: false });
    this.cdr.markForCheck();
  }
  private failSave(msg: string) { this.saving = false; this.errorMsg = msg; this.cdr.markForCheck(); }
  private computeFotoToSend(): string | undefined { return this.t(this.selectedAvatar || this.foto || this.model?.foto) || undefined; }
  private async computeAliasToSend(): Promise<string | undefined> {
    const aliasNuevo = this.t(this.model?.alias);
    if (!aliasNuevo) return undefined;
    const noCambio =
      this.userAliasActual &&
      aliasNuevo &&
      aliasNuevo.localeCompare(this.userAliasActual, undefined, {
        sensitivity: 'accent'
      }) === 0;

    if (noCambio) return undefined;
    if (this.aliasError) {
      throw new Error(this.aliasError);
    }
    if (this.aliasTaken) {
      throw new Error('El alias ya existe. Elige otro.');
    }
    if (this.aliasChecking) {
      throw new Error('Espera a que termine la comprobación del alias.');
    }
    const ok = await this.ensureAliasDisponible(aliasNuevo);
    if (!ok) throw new Error('El alias ya existe. Elige otro.');

    return aliasNuevo;
  }

  private async ensureAliasDisponible(alias: string): Promise<boolean> {
    try { const res = await firstValueFrom(this.auth.checkAlias(alias)); return !!res?.available; }
    catch { return false; }
  }
  private validateProfileFields(): string | null {
    if (this.aliasError) {
      return this.aliasError;
    }
    const n = this.t(this.model?.nombre);
    const a = this.t(this.model?.apellidos);
    const al = this.t(this.model?.alias);
    if (n && n.length > this.MAX.nombre) return `El nombre supera ${this.MAX.nombre} caracteres.`;
    if (a && a.length > this.MAX.apellidos) return `Los apellidos superan ${this.MAX.apellidos} caracteres.`;
    if (al && (al.length < this.ALIAS_MIN || al.length > this.MAX.alias)) return `El alias debe tener entre ${this.ALIAS_MIN} y ${this.MAX.alias} caracteres.`;
    return null;
  }
  getInitials(nombre: string): string { const safe = this.t(nombre); return safe ? safe.split(/\s+/).map(p => p[0]).join('').toUpperCase() : 'U'; }
  private isAdmin(): boolean { return (this.loggedUser?.role ?? '').toString().toUpperCase() === 'ADMINISTRADOR'; }
  canSeeVip(): boolean { return !!this.model.vip || (this.readOnly && this.fromAdmin && this.isAdmin()); }




  public cargarContenidos(): void {
    this.contenidosLoading = true; this.contenidosError = null;
    this.http.get<any[]>(`${this.CONTENIDOS_BASE}/ListarContenidos`).subscribe({
      next: (raw) => {
        const items: Contenido[] = (raw || []).map((c: any) => ({
          id: c.id ?? c._id ?? '',
          userEmail: c.userEmail,
          titulo: c.titulo,
          descripcion: c.descripcion,
          ficheroAudio: c.ficheroAudio,
          urlVideo: c.urlVideo,
          tags: c.tags ?? [],
          duracionMinutos: c.duracionMinutos,
          resolucion: c.resolucion,
          vip: !!c.vip,
          visible: !!c.visible,
          disponibleHasta: c.disponibleHasta,
          restringidoEdad: Number(c.restringidoEdad ?? 0),
          tipo: c.tipo,
          imagen: c.imagen,
          reproducciones: c.reproducciones ?? 0,
          fechaEstado: c.fechaEstado,
        }))
          .filter(item => item.visible)
          .filter(item => this.canSeeVip() ? true : !item.vip)
          .filter(item => this.canSeeByAge(item))
          .sort((a, b) => {
            const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
            const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
            return tb - ta;
          });
        this.catalogBackup = items.slice(0);
        this.contenidos = items;
        this.tiposDisponibles = this.DEFAULT_TIPOS.slice();
        this.categoriasDisponibles = this.DEFAULT_CATEGORIAS.slice();
        this.resolucionesDisponibles = this.DEFAULT_RESOLUCIONES.slice();
        this.contenidosLoading = false;
        if (this.filterMode === 'favoritos' && !this.favsLoaded) this.loadFavoritos();
        this.applyFilter();
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        console.error(err);
        this.contenidosError = 'No se pudieron cargar los contenidos.';
        this.contenidosLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private isHttpUrl(u: unknown): u is string {
    if (typeof u !== 'string') return false;
    const s = u.trim().toLowerCase();
    return s.startsWith('http://') || s.startsWith('https://');
  }
  private toNum(v: unknown): number { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; }
  private calcAgeFromISO(iso?: string | null): number | null {
    if (!iso) return null;
    const d = new Date(iso); if (isNaN(+d)) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  }

  private playingBusy = false;
  private openedExternally = false;
  private openedInternally = false;

  private showError(msg: string) {
    if (this.openedExternally || this.openedInternally) return;
    Swal.fire({ icon: 'error', title: 'Reproducción no disponible', text: msg });
    this.closePlayer();
    this.launchingId = null;
  }

  async play(c: any) {
    if (this.playingBusy) return;
    if (!this.canPlay()) {
      this.showError('Estás en modo lectura (Administrador). La reproducción está deshabilitada.');
      return;
    }
    this.startLaunch(c.id);
    this.playingBusy = true;
    this.openedExternally = false;
    this.openedInternally = false;

    const role = this.loggedUser?.role ?? 'USUARIO';
    const email = this.userEmail;
    const vip = !!this.model?.vip;
    const fechaNacISO = this.model?.fechaNac || undefined;
    const ageYears = this.calcAgeFromISO(fechaNacISO) ?? undefined;
    const isUsuario = String(role).toUpperCase() === 'USUARIO';
    const streamParams = { id: c.id, role, email, vip, fechaNacISO, ageYears };

    try {
      await this.contenidosSvc.canStream(streamParams);
      const result = await this.tryResolveContent(c, streamParams);
      if (!result) throw new Error('No se obtuvo resultado de reproducción.');
      if (result.kind === 'external') { this.handleExternalPlay(result.url, c, isUsuario); return; }
      this.handleInternalPlay(result.blobUrl, c, isUsuario);
    } catch (e: any) {
      const msg = e?.message ?? 'No se pudo reproducir este contenido.';
      this.showError(msg);
    } finally {
      this.playingBusy = false;
      this.launchingId = null;
    }
  }

  private async tryResolveContent(c: any, params: any): Promise<ResolveResult | null> {
    try { return await this.contenidosSvc.resolveAndCount(params); }
    catch (e: any) {
      if (e?.message === 'HTTP0_OPAQUE' && this.isHttpUrl(c?.urlVideo)) {
        this.handleExternalPlay(c.urlVideo, c, String(params.role).toUpperCase() === 'USUARIO');
        throw new Error('Reproducción externa forzada');
      }
      throw e;
    }
  }


  private handleExternalPlay(url: string, content: any, isUsuario: boolean): void {
    const ytembed = toYouTubeEmbed(url);
    const vimbed = toVimeoEmbed(url);
    if (ytembed || vimbed) {
      this.playerKind = 'EMBED';
      const finalUrl = ytembed || vimbed!;
      this.embedUrl = this.s.bypassSecurityTrustResourceUrl(finalUrl);
      this.playerSrc = null;
      this.iframeKey++;
    } else if (isDirectMedia(url)) {
      this.playerKind = 'VIDEO';
      this.playerSrc = url;
      this.embedUrl = null;
    } else {
      this.playerKind = 'EMBED';
      const html = `
        <html><body style="background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100%;">
          <div style="text-align:center;max-width:560px;padding:16px;">
            <p>Este proveedor no permite incrustar el reproductor.</p>
            <p><a href="${url}" target="_blank" rel="noopener noreferrer"
                  style="display:inline-block;padding:10px 16px;background:#fff;color:#111;border-radius:8px;text-decoration:none;">
                  Abrir en una nueva pestaña</a></p>
          </div>
        </body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const localUrl = URL.createObjectURL(blob);
      this.embedUrl = this.s.bypassSecurityTrustResourceUrl(localUrl);
      this.playerSrc = null;
      this.iframeKey++; // ✅
    }
    this.playingId = content.id;
    this.playingTitle = content.titulo || null;
    this.playerOpen = true;
    this.openedInternally = true;
    this.openedExternally = false;
    if (isUsuario) {
      this.incrementViews(content);
      this.pushToHistory(content);
    }
    this.cdr.markForCheck();
  }


  private handleInternalPlay(blobUrl: string, content: any, isUsuario: boolean): void {
    this.playerKind = String(content.tipo).toUpperCase() === 'AUDIO' ? 'AUDIO' : 'VIDEO';
    this.playerSrc = blobUrl;
    this.embedUrl = null;
    this.playingId = content.id;
    this.playingTitle = content.titulo || null;
    this.playerOpen = true;
    this.openedInternally = true;
    if (isUsuario) {
      this.incrementViews(content);
      this.pushToHistory(content);
    }
    this.cdr.markForCheck();
  }


  private incrementViews(content: any): void { content.reproducciones = this.toNum(content.reproducciones) + 1; }

  closePlayer() {

    const v = this.videoRef?.nativeElement;
    if (v) {
      try { v.pause(); } catch { }
      try { v.removeAttribute('src'); v.load(); } catch { }
    }

    const a = this.audioRef?.nativeElement;
    if (a) {
      try { a.pause(); } catch { }
      try { a.removeAttribute('src'); a.load(); } catch { }
    }
    this.embedUrl = null;
    this.iframeKey++;

    try { if (this.playerSrc?.startsWith('blob:')) URL.revokeObjectURL(this.playerSrc); } catch { }

    this.playerOpen = false;
    this.playerSrc = null;
    this.playingId = null;
    this.playingTitle = null;

    this.cdr.markForCheck();
  }

  private ratingOpen = new Set<string>();
  isRatingOpen(c: { id: string }): boolean { return !!c?.id && this.ratingOpen.has(c.id); }
  toggleRating(c: { id: string }): void { if (!c?.id) return; this.ratingOpen.has(c.id) ? this.ratingOpen.delete(c.id) : this.ratingOpen.add(c.id); }
  closeRating(c: { id: string }): void { if (!c?.id) return; this.ratingOpen.delete(c.id); }
  onRated(id: string, _resumen: any) { this.ratingOpen.delete(id); this.cargarContenidos(); }
  onVipChanged(v: boolean): void { this.model.vip = !!v; this.cargarContenidos(); this.cdr.markForCheck(); }

  selectedContent: Contenido | null = null;
  isDetailsModalOpen = false;

  openDetails(c: Contenido): void {
    this.selectedContent = c;
    this.isDetailsModalOpen = true;
    this.cdr.markForCheck();
  }

  closeDetails(): void {
    this.isDetailsModalOpen = false;
    setTimeout(() => {
      this.selectedContent = null;
      this.cdr.markForCheck();
    }, 300); // Wait for animation if any
  }

  filterMode: 'todos' | 'favoritos' | 'historial' = 'todos';
  onFilterChange(): void {
    if (this.filterMode === 'favoritos' && !this.favsLoaded) this.loadFavoritos();
    if (this.filterMode === 'historial') this.loadHistory();
    this.applyFilter();
  }

  private applyFilter(): void {
    const base0: Contenido[] = this.catalogBackup ?? this.contenidos.slice(0);

    const base = base0
      .filter(item => this.canSeeVip() ? true : !item.vip)
      .filter(item => this.canSeeByAge(item));
    const applyModeFilter = (src: Contenido[]): Contenido[] | null => {
      if (this.filterMode === 'favoritos') {
        if (!this.favsLoaded) {
          // While loading favorites, avoid showing "Todos". Show empty or keep current.
          // Better to return empty so user knows it's filtering.
          this.filteredCon = [];
          this.page = 1;
          return null;
        }
        const favSet = this.favIds;
        return src.filter(c => favSet.has(c.id));
      } else if (this.filterMode === 'historial') {
        if (!this.historyLoaded) this.loadHistory();
        return src.filter(c => this.historyIds.has(c.id));
      }
      return src;
    };


    const applyListaFilter = (src: Contenido[], listaIdRaw: string): Contenido[] => {
      const listaId = String(listaIdRaw || '').trim();
      if (!listaId) return src;
      const lista = this.listasPublicas.find(l => String(l.id) === listaId);
      const idsLista = new Set<string>();
      if (lista) {
        if (Array.isArray(lista.contenidosIds)) {
          lista.contenidosIds.forEach((x: any) => idsLista.add(String(x)));
        }
        if (Array.isArray(lista.contenidos)) {
          lista.contenidos.forEach((x: any) => idsLista.add(String(x?.id ?? x)));
        }
      }
      return idsLista.size > 0 ? src.filter(c => idsLista.has(String(c.id))) : [];
    };

    const buildParams = (f: any) => ({
      q: String(f.q ?? '').trim().toLowerCase(),
      wantTipo: String(f.tipo ?? '').trim().toUpperCase(),
      wantCat: this.normalizeTag(f.categoria),
      wantRole: (f.role || '').toUpperCase(),
      wantRes: String(f.resolucion ?? '').trim(),
      ageMode: f.ageMode,
      ageVal: f.ageValue
    });

    const sortResults = (arr: Contenido[], f: any) => {
      const dir = f.dir === 'asc' ? 1 : -1;
      const ordenar = f.ordenar;
      arr.sort((a, b) => {
        let score = 0;
        if (ordenar === 'fecha') {
          const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
          const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
          score = tb - ta;
        } else if (ordenar === 'titulo') {
          score = String(a.titulo || '').localeCompare(String(b.titulo || ''));
        } else if (ordenar === 'reproducciones') {
          score = (b.reproducciones || 0) - (a.reproducciones || 0);
        }
        return score * dir;
      });
    };

    let working = base;
    const modeResult = applyModeFilter(base);
    if (modeResult === null) return;
    working = modeResult;

    const f = this.filtrosContenido;
    working = applyListaFilter(working, f.listaId);

    const params = buildParams(f);
    const out = working.filter(c => this.matchesFilter(c, params));

    sortResults(out, f);

    this.filteredCon = out;
    this.page = 1;
  }


  private matchesFilter(
    c: Contenido,
    opts: { q: string; wantTipo: string; wantCat: string; wantRole: string; wantRes: string; ageMode: AgeMode; ageVal: number | null }
  ): boolean {
    const { q, wantTipo, wantCat, wantRole, wantRes, ageMode, ageVal } = opts;

    const qLower = String(q ?? '').trim().toLowerCase();
    const titleOk = !qLower || (String(c.titulo || '').toLowerCase().includes(qLower));

    const tipoOk = !wantTipo || String(c.tipo || '').toUpperCase() === wantTipo;

    const roleOk = !wantRole || (wantRole === 'VIP' ? !!c.vip : wantRole === 'STANDARD' ? !c.vip : true);

    const wantCatNorm = String(wantCat ?? '').trim().toLowerCase();
    const tagsNorm = (c.tags ?? []).map(this.normalizeTag.bind(this));
    const catOk = !wantCatNorm || tagsNorm.includes(wantCatNorm);

    const resOk = !wantRes || String(c.resolucion ?? '').trim() === wantRes;

    const ageOk = (() => {
      if (!ageMode || ageVal === null) return true;
      const minAge = Number(c.restringidoEdad ?? 0);
      return ageMode === 'mayores' ? minAge >= ageVal : minAge <= ageVal;
    })();

    return titleOk && tipoOk && roleOk && catOk && resOk && ageOk;
  }

  private normalizeTag(t: unknown): string { return String(t ?? '').trim().toLowerCase(); }
  private applyFrontFilters(): void {
    const base = this.catalogBackup ?? [];
    const f = this.filtrosContenido;
    const q = String(f.q ?? '').trim().toLowerCase();
    const wantTipo = String(f.tipo ?? '').trim().toUpperCase();
    const wantCat = this.normalizeTag(f.categoria);
    const wantRole = (f.role || '').toUpperCase();
    const wantRes = String(f.resolucion ?? '').trim();
    const matchesText = (c: Contenido) => !q || [c.titulo, c.descripcion].some(v => String(v ?? '').toLowerCase().includes(q));
    const matchesTipo = (c: Contenido) => !wantTipo || String(c.tipo ?? '').toUpperCase() === wantTipo;
    const matchesCategoria = (c: Contenido) => { if (!wantCat) return true; const tags = (c.tags ?? []).map(this.normalizeTag.bind(this)); return tags.includes(wantCat); };
    const matchesRole = (c: Contenido) => !wantRole ? true : (wantRole === 'VIP' ? !!c.vip : !c.vip);
    const matchesEdad = (c: Contenido) => {
      const minAge = Number(c.restringidoEdad ?? 0); const v = f.ageValue ?? null;
      if (!f.ageMode || v === null) return true;
      return f.ageMode === 'mayores' ? minAge >= v : minAge <= v;
    };
    const matchesResolucion = (c: Contenido) => !wantRes || String(c.resolucion ?? '').trim() === wantRes;
    let out = base.filter(matchesText).filter(matchesTipo).filter(matchesCategoria).filter(matchesRole).filter(matchesEdad).filter(matchesResolucion);
    const cmp = this.cmpOrden(f.ordenar);
    out.sort((a, b) => { const s = cmp(a, b); return f.dir === 'asc' ? s : -s; });
    this.contenidos = out;
    this.cdr.markForCheck();
  }
  private cmpOrden(kind: OrdenContenido): (a: Contenido, b: Contenido) => number {
    switch (kind) {
      case 'titulo': return (a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''));
      case 'reproducciones': return (a, b) => (a.reproducciones ?? 0) - (b.reproducciones ?? 0);
      case 'fecha':
      default:
        return (a, b) => {
          const ta = a.fechaEstado ? new Date(a.fechaEstado).getTime() : 0;
          const tb = b.fechaEstado ? new Date(b.fechaEstado).getTime() : 0;
          return ta - tb;
        };
    }
  }
  private matchesAgeRule(mode: AgeMode, minAge: number, x: number | null): boolean { if (!mode || x === null) return true; return mode === 'mayores' ? minAge >= x : minAge <= x; }
  private get isAdminReadOnly(): boolean {
    return this.readOnly && this.fromAdmin && this.isAdmin();
  }

  public canPlay(): boolean {
    return !this.isAdminReadOnly;
  }

  private getCurrentAge(): number | null {
    return this.calcAgeFromISO(this.model?.fechaNac || null);
  }

  private canSeeByAge(item: { restringidoEdad?: number | null }): boolean {
    if (this.readOnly && this.fromAdmin && this.isAdmin()) return true;
    const min = this.toNum(item?.restringidoEdad ?? 0);
    if (min <= 0) return true;
    const age = this.getCurrentAge();
    if (age === null) return false;
    return age >= min;
  }


}
