import type { Translation } from './en';

export const fr: Translation = {
  app: {
    title: 'NetForge - Concepteur d’infrastructure',
    description: 'Concevez votre infrastructure réseau avec VLANs, Trunks et Tagging',
    tagline: 'Concepteur de topologie d’infrastructure',
  },
  common: {
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', create: 'Créer', add: 'Ajouter', close: 'Fermer',
    confirm: 'Confirmer', yes: 'Oui', no: 'Non', loading: 'Chargement…', search: 'Rechercher', none: 'Aucun', error: 'Erreur',
    retry: 'Réessayer', back: 'Retour', name: 'Nom', optional: 'facultatif', import: 'Importer', export: 'Exporter',
    actions: 'Actions', copy: 'Copier', copied: 'Copié', download: 'Télécharger', settings: 'Paramètres', language: 'Langue',
    logout: 'Se déconnecter', required: 'Obligatoire', noData: 'Aucune donnée', deleteConfirm: 'Supprimer « {{name}} » ? Cette action est irréversible.',
    readOnly: 'Lecture seule', theme: 'Thème', light: 'Clair', dark: 'Sombre', refresh: 'Actualiser', details: 'Détails',
  },
  auth: {
    signIn: 'Se connecter', email: 'E-mail', password: 'Mot de passe', serverUrl: 'URL du serveur', server: 'Serveur',
    invalidCredentials: 'E-mail ou mot de passe invalide', signingIn: 'Connexion…', changePassword: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel', newPassword: 'Nouveau mot de passe (8 caractères min.)', passwordChanged: 'Mot de passe mis à jour',
    welcome: 'Bienvenue, {{name}}', connectionFailed: 'Serveur injoignable. Vérifiez l’URL et votre réseau.',
  },
  roles: { admin: 'Admin', technician: 'Technicien', viewer: 'Lecteur' },
  sidebar: {
    clients: 'Clients', devices: 'Bibliothèque d’équipements', search: 'Rechercher...', newClient: 'Nouveau client', newSite: 'Nouveau site',
    noClient: 'Aucun client pour l’instant. Créez-en un pour commencer.', selectClient: 'Choisir un client', sites: 'Sites',
    unassigned: 'Sans site', renameClient: 'Renommer le client', clientName: 'Nom du client', siteName: 'Nom du site',
    customDevice: 'Équipement personnalisé', dragHint: 'Glissez un équipement sur le canvas',
  },
  deviceTypes: {
    firewall: 'Pare-feu', switch: 'Commutateur', router: 'Routeur', server: 'Serveur', access_point: 'Borne WiFi', client: 'Client',
  },
  deviceRoles: { core: 'Core', distribution: 'Distribution', access: 'Accès', dmz: 'DMZ', backup: 'Backup' },
  modals: {
    device: {
      title: 'Propriétés de l’équipement', identity: 'Identité & Contexte', management: 'Management & Accès', vlanMapping: 'Mapping VLAN',
      name: 'Nom', client: 'Client', site: 'Site', type: 'Type', model: 'Modèle', serial: 'Numéro de série', role: 'Rôle',
      mgmtIp: 'IP de management', mgmtIpHint: 'ex : 192.168.1.254/24', gateway: 'Passerelle', mgmtPort: 'Port de management',
      protocols: 'Protocoles', credentials: 'Identifiants', username: 'Nom d’utilisateur', password: 'Mot de passe',
      passwordStored: 'Un mot de passe est enregistré (chiffré). Laissez vide pour le conserver.', revealPassword: 'Afficher le mot de passe',
      mgmtVlan: 'VLAN de management', ports: 'Ports', portCount: 'Nombre de ports', portPrefix: 'Préfixe des ports',
      portsHint: 'Les ports sont nommés préfixe + numéro, ex : Gi1/0/1', connections: 'Connexions',
    },
    cable: {
      title: 'Configuration du câble', sourcePort: 'Port source', destPort: 'Port destination', mode: 'Mode',
      access: 'Accès', trunk: 'Trunk', nativeVlan: 'VLAN natif (Untagged)', destNativeVlan: 'VLAN natif (côté destination)',
      taggedVlans: 'VLANs tagués', taggedHint: 'ex : 10,20,30-35', accessVlan: 'VLAN d’accès', from: 'De', to: 'Vers',
      sameAsSource: 'identique à la source',
    },
  },
  alerts: {
    title: 'Alertes', critical: 'Critique', warning: 'Attention', info: 'Information', none: 'Aucun problème détecté 🎉',
    messages: {
      R001: 'Un équipement client ({{device}}) ne peut pas être connecté en mode Trunk.',
      R002: 'VLAN natif différent sur le trunk {{source}} ↔ {{dest}} ({{a}} contre {{b}}).',
      R003: 'Le commutateur {{source}} est relié au commutateur {{dest}} en mode Accès ; utilisez un Trunk.',
      R004: 'L’équipement {{device}} n’a pas d’IP de management.',
      R005: 'Les ports source et destination sont identiques ({{device}} {{port}}).',
      R006: 'Le trunk {{source}} ↔ {{dest}} n’a aucun VLAN tagué.',
      R007: 'Le lien en mode Accès {{source}} ↔ {{dest}} n’a pas de VLAN défini.',
      R008: 'Le port {{port}} de {{device}} est utilisé par {{count}} liens.',
      R009: 'L’IP de management {{ip}} est utilisée par plusieurs équipements ({{devices}}).',
      R010: 'Le lien {{source}} ↔ {{dest}} boucle sur le même équipement.',
      R011: 'L’IP de management de {{device}} n’est pas une adresse IPv4 valide.',
      R012: 'Un lien fait référence à un équipement inexistant.',
    },
  },
  exports: {
    title: 'Exporter', csv: 'Exporter CSV (matrice de câblage)', pdf: 'Exporter PDF', png: 'Exporter PNG', svg: 'Exporter SVG',
    config: 'Exporter le script de configuration', shmnlt: 'Exporter .shmnlt', importShmnlt: 'Importer .shmnlt', vendor: 'Constructeur',
    scope: 'Périmètre', allDevices: 'Tous les équipements réseau', thisDevice: 'Cet équipement', cisco: 'Cisco IOS', huawei: 'Huawei VRP',
    arista: 'Arista EOS', imported: '{{devices}} équipements et {{links}} liens importés', failed: 'Échec de l’export',
  },
  search: { placeholder: 'Rechercher équipement, IP, port, client…', noResults: 'Aucun résultat', hint: 'Ctrl+P' },
  revisions: {
    title: 'Historique des versions', save: 'Enregistrer une version', note: 'Note (facultative)', restore: 'Restaurer', empty: 'Aucune version enregistrée.',
    saved: 'Version enregistrée', restoreConfirm: 'Remplacer le schéma actuel par cette version ? Une sauvegarde est créée avant.',
    restored: 'Version restaurée', by: 'par {{name}}',
  },
  users: {
    title: 'Utilisateurs', add: 'Ajouter un utilisateur', role: 'Rôle', email: 'E-mail', name: 'Nom', password: 'Mot de passe',
    deleteSelf: 'Vous ne pouvez pas supprimer votre propre compte.',
  },
  canvas: {
    empty: 'Glissez un équipement depuis la bibliothèque pour commencer', connectHint: 'Tirez depuis la poignée d’un équipement vers un autre pour créer un câble',
    deleteSelection: 'Supprimer la sélection', fit: 'Ajuster la vue', zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', links: 'liens', devices: 'équipements',
    editCable: 'Modifier le câble', editDevice: 'Modifier l’équipement', removeDevice: 'Retirer l’équipement', removeCable: 'Retirer le câble',
    differentClient: 'Les deux équipements doivent appartenir au même client.',
  },
  mobile: {
    diagram: 'Schéma', cables: 'Câbles', addCable: 'Ajouter un câble', addDevice: 'Ajouter un équipement', pickDevice: 'Choisir un équipement', pickPort: 'Choisir un port',
    server: 'URL du serveur (ex. https://netforge.exemple.com)', empty: 'Rien ici pour le moment', pullToRefresh: 'Tirez vers le bas pour actualiser',
    shareFailed: 'Impossible de partager le fichier', settings: 'Réglages', deleteDevice: 'Supprimer l’équipement', deleteCable: 'Supprimer le câble',
    portInUse: 'utilisé', sameDevice: 'Choisissez deux équipements différents', tapDevice: 'Touchez un équipement pour l’ouvrir', imported: 'Import terminé',
  },
  errors: {
    network: 'Erreur réseau', unauthorized: 'Session expirée, veuillez vous reconnecter', forbidden: 'Vous n’avez pas la permission',
    generic: 'Une erreur est survenue', notFound: 'Introuvable',
  },
};
