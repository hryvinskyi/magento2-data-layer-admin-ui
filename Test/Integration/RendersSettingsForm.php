<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Magento\Backend\Model\Auth;
use Magento\Config\Block\System\Config\Form;
use Magento\Config\Model\ConfigFactory;
use Magento\Config\Model\ResourceModel\Config\Data\CollectionFactory;
use Magento\Framework\App\Config\ReinitableConfigInterface;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Data\Form\Element\AbstractElement;
use Magento\Framework\View\LayoutInterface;
use Magento\Store\Model\StoreManagerInterface;
use Magento\TestFramework\Bootstrap;

/**
 * Renders a settings section the way the admin's configuration page does, for a signed-in administrator, and saves
 * and reads settings the way the page posts them
 */
trait RendersSettingsForm
{
    use ResolvesServices;

    /**
     * Build the settings form of a section at the default scope or a website's
     *
     * @param string $section
     * @param int|null $websiteId Null for the default scope
     * @return Form
     */
    private function settingsForm(string $section, ?int $websiteId = null): Form
    {
        $auth = $this->service(Auth::class);
        if (!$auth->isLoggedIn()) {
            $auth->login(Bootstrap::ADMIN_NAME, Bootstrap::ADMIN_PASSWORD);
        }
        $this->service(ReinitableConfigInterface::class)->reinit();
        $request = $this->service(HttpRequest::class, RequestInterface::class);
        $request->setParam('section', $section);
        $request->setParam('website', $websiteId !== null ? (string) $websiteId : null);
        $request->setParam('store', null);
        $form = $this->checked($this->service(LayoutInterface::class)->createBlock(Form::class), Form::class);
        $form->initForm();

        return $form;
    }

    /**
     * Render one row of a settings form
     *
     * @param Form $form
     * @param string $elementId
     * @return string
     */
    private function rowHtml(Form $form, string $elementId): string
    {
        $element = $form->getForm()->getElement($elementId);
        if (!$element instanceof AbstractElement) {
            throw new \LogicException(sprintf('The form has no element "%s".', $elementId));
        }
        $html = $element->toHtml();

        return is_string($html) ? $html : '';
    }

    /**
     * Parse rendered markup the way a browser builds its document, to query it by structure rather than by text
     *
     * @param string $html
     * @return \DOMXPath
     */
    private function parsed(string $html): \DOMXPath
    {
        $document = new \DOMDocument();
        $errors = libxml_use_internal_errors(true);
        $document->loadHTML(
            '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' . $html . '</body></html>'
        );
        libxml_clear_errors();
        libxml_use_internal_errors($errors);

        return new \DOMXPath($document);
    }

    /**
     * Find the elements an XPath expression selects
     *
     * @param \DOMXPath $xpath
     * @param string $expression
     * @param \DOMNode|null $context
     * @return list<\DOMElement>
     */
    private function elements(\DOMXPath $xpath, string $expression, ?\DOMNode $context = null): array
    {
        $found = [];
        $nodes = $xpath->query($expression, $context);
        foreach ($nodes === false ? [] : $nodes as $node) {
            if ($node instanceof \DOMElement) {
                $found[] = $node;
            }
        }

        return $found;
    }

    /**
     * Read an element's text with its white space collapsed, as a browser shows it
     *
     * @param \DOMNode $node
     * @return string
     */
    private function textOf(\DOMNode $node): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $node->textContent));
    }

    /**
     * Save groups of a section the way the admin form posts them
     *
     * @param string $section
     * @param array<string, mixed> $groups
     * @param int|null $websiteId Null for the default scope
     * @return void
     */
    private function saveSettings(string $section, array $groups, ?int $websiteId = null): void
    {
        $this->service(ConfigFactory::class)->create(['data' => [
            'section' => $section,
            'website' => $websiteId !== null ? (string) $websiteId : null,
            'store' => null,
            'groups' => $groups,
        ]])->save();
        $this->service(ReinitableConfigInterface::class)->reinit();
    }

    /**
     * Read a setting as stored at one scope
     *
     * @param string $path
     * @param int|null $websiteId Null for the default scope
     * @return string|null Null when no row is stored there
     */
    private function storedSetting(string $path, ?int $websiteId = null): ?string
    {
        $collection = $this->service(CollectionFactory::class)->create();
        $collection->addFieldToFilter('path', $path)
            ->addFieldToFilter('scope', $websiteId === null ? 'default' : 'websites')
            ->addFieldToFilter('scope_id', (string) ($websiteId ?? 0));
        $row = $collection->getFirstItem();
        $value = $row->getData('value');

        return $row->getId() === null ? null : (is_scalar($value) ? (string) $value : '');
    }

    /**
     * Get the main website's id
     *
     * @return int
     */
    private function mainWebsiteId(): int
    {
        return (int) $this->service(StoreManagerInterface::class)->getWebsite('base')->getId();
    }

    /**
     * Sign the administrator out
     *
     * @return void
     */
    private function signOut(): void
    {
        $auth = $this->service(Auth::class);
        if ($auth->isLoggedIn()) {
            $auth->logout();
        }
    }
}
